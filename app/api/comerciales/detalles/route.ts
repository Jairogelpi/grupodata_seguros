import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const asesorName = searchParams.get('asesor');
        const anio = searchParams.get('anio');
        const mes = searchParams.get('mes');

        if (!asesorName || !anio || !mes) {
            return NextResponse.json({ error: 'Faltan parámetros (asesor, anio, mes)' }, { status: 400 });
        }

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Advisor mapping via Ente Code (Same logic as evolution)
        const codeToAsesorMap = new Map<string, string>();
        const validEnteCodes = new Set<string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || '').trim();
            codeToAsesorMap.set(code, asesor);
            validEnteCodes.add(code);
        });

        const getPolizaAsesor = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            const code = validEnteCodes.has(codeFromEnte) ? codeFromEnte : (validEnteCodes.has(codeDirect) ? codeDirect : null);
            return code ? codeToAsesorMap.get(code) : null;
        };

        // 3. Filter Policies for this specific month/advisor
        const filteredPolizas = polizas.filter(p => {
            const name = getPolizaAsesor(p);
            if (name !== asesorName) return false;

            const pAnio = parseInt(p['AÑO_PROD']);
            const pMes = parseInt(p['MES_Prod']);

            return pAnio === targetAnio && pMes === targetMes;
        }).map(p => {
            const fEfectoStr = p['F.Efecto'] || '';
            const fAnulaStr = p['F.Anulación'] || '';
            const estado = p['Estado'] || 'N/A';

            let diasHastaAnula = null;

            if (fEfectoStr) {
                try {
                    // Dates in Spanish format DD/MM/YYYY
                    const [dE, mE, yE] = fEfectoStr.split('/').map(Number);
                    const dateE = new Date(yE, mE - 1, dE);

                    if (!isNaN(dateE.getTime())) {
                        let targetDate: Date;

                        if (fAnulaStr) {
                            const [dA, mA, yA] = fAnulaStr.split('/').map(Number);
                            targetDate = new Date(yA, mA - 1, dA);
                        } else if (estado.toUpperCase().includes('VIGOR')) {
                            targetDate = new Date();
                        } else {
                            // Without explicit cancellation date or Vigor status, we don't calc days
                            return {
                                poliza: p['NºPóliza'] || p['Poliza'] || 'N/A',
                                estado,
                                tomador: p['Tomador'] || 'N/A',
                                producto: p['Producto'] || 'N/A',
                                fechaEfecto: fEfectoStr,
                                fechaAnulacion: fAnulaStr,
                                diasHastaAnula: null,
                                dni: p['NIF/CIF Tomador'] || 'N/A',
                                primas: parseFloat(String(p['P.Produccion'] || '0').replace(',', '.')) || 0,
                                cartera: parseFloat(String(p['P.Cartera'] || '0').replace(',', '.')) || 0,
                                motivoAnulacion: p['Mot.Anulación'] || '',
                                compania: p['Abrev.Cía'] || 'N/A',
                                duracion: p['Duración'] || '',
                                formaPago: p['Forma Pago'] || '',
                                fAlta: p['F. Alta'] || ''
                            };
                        }

                        if (!isNaN(targetDate.getTime())) {
                            const diffTime = Math.abs(targetDate.getTime() - dateE.getTime());
                            diasHastaAnula = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }
                } catch (e) {
                    console.error('Error calculando dias de anulación', e);
                }
            }

            return {
                poliza: p['NºPóliza'] || p['Poliza'] || 'N/A',
                estado,
                tomador: p['Tomador'] || 'N/A',
                producto: p['Producto'] || 'N/A',
                fechaEfecto: fEfectoStr,
                fechaAnulacion: fAnulaStr,
                diasHastaAnula,
                dni: p['NIF/CIF Tomador'] || 'N/A',
                primas: parseFloat(String(p['P.Produccion'] || '0').replace(',', '.')) || 0,
                cartera: parseFloat(String(p['P.Cartera'] || '0').replace(',', '.')) || 0,
                motivoAnulacion: p['Mot.Anulación'] || '',
                compania: p['Abrev.Cía'] || 'N/A',
                duracion: p['Duración'] || '',
                formaPago: p['Forma Pago'] || '',
                fAlta: p['F. Alta'] || ''
            };
        });

        return NextResponse.json({
            asesor: asesorName,
            anio: targetAnio,
            mes: targetMes,
            polizas: filteredPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch advisor detail data' }, { status: 500 });
    }
}
