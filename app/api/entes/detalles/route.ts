import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');
        const anio = searchParams.get('anio');
        const mes = searchParams.get('mes');

        if (!enteName || !anio || !mes) {
            return NextResponse.json({ error: 'Faltan parámetros (ente, anio, mes)' }, { status: 400 });
        }

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Ente Code (Same logic as evolution)
        const validEnteNames = new Set<string>();
        const codeToNameMap = new Map<string, string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            validEnteNames.add(val);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            codeToNameMap.set(code, val);
        });

        const getPolizaEnteName = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            if (validEnteNames.has(enteComercial)) return enteComercial;

            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');

            return codeToNameMap.get(codeFromEnte) || codeToNameMap.get(codeDirect) || null;
        };

        // 3. Filter Policies for this specific month/ente
        const filteredPolizas = polizas.filter(p => {
            const name = getPolizaEnteName(p);
            if (name !== enteName) return false;

            const pAnio = parseInt(p['AÑO_PROD']);
            const pMes = parseInt(p['MES_Prod']);

            return pAnio === targetAnio && pMes === targetMes;
        }).map(p => {
            const fEfectoStr = p['F.Efecto'] || '';
            const fAnulaStr = p['F.Anulación'] || '';
            const estado = p['Estado'] || '';

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
                            // If still in vigor, use current date
                            targetDate = new Date();
                        } else {
                            // Other states without cancellation date don't get a "days" calculation
                            return {
                                poliza: p['NºPóliza'] || p['Poliza'] || 'N/A',
                                estado: p['Estado'] || 'N/A',
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
                estado: p['Estado'] || 'N/A',
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
            ente: enteName,
            anio: targetAnio,
            mes: targetMes,
            polizas: filteredPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch monthly details' }, { status: 500 });
    }
}
