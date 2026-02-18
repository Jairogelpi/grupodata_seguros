import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');
        const asesorName = searchParams.get('asesor');
        const estadoFilter = searchParams.get('estado'); // VIGOR, SUSPENSIONAL, ANULADA
        const startYear = searchParams.get('startYear');
        const startMonth = searchParams.get('startMonth');
        const endYear = searchParams.get('endYear');
        const endMonth = searchParams.get('endMonth');
        const ramoFilter = searchParams.get('ramo'); // Ramo classification filter

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Ente Code
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

        const getPolizaAsesorName = (p: any) => {
            const name = getPolizaEnteName(p);
            if (!name) return null;
            const link = links.find(l => String(l['ENTE']) === name);
            return link ? String(link['ASESOR'] || '') : null;
        };

        // 3. Filter Policies
        const filteredPolizas = polizas.filter(p => {
            // Filter by Ente
            if (enteName) {
                const pEnte = getPolizaEnteName(p);
                if (pEnte !== enteName) return false;
            }

            // Filter by Asesor
            if (asesorName) {
                const pAsesor = getPolizaAsesorName(p);
                if (pAsesor !== asesorName) return false;
            }

            // Filter by Estado
            if (estadoFilter) {
                const estado = String(p['Estado'] || '').toUpperCase();
                if (estadoFilter === 'VIGOR' && !estado.includes('VIGOR')) return false;
                if (estadoFilter === 'SUSPENSION' && !estado.includes('SUSPENSI')) return false;
                if (estadoFilter === 'ANULADA' && !estado.includes('ANULADA')) return false;
            }

            // Filter by Period Ratio (Año/Mes de producción)
            if (startYear && startMonth && endYear && endMonth) {
                const pAnio = parseInt(p['AÑO_PROD']);
                const pMes = parseInt(p['MES_Prod']);
                const startVal = parseInt(startYear) * 100 + parseInt(startMonth);
                const endVal = parseInt(endYear) * 100 + parseInt(endMonth);
                const currentVal = pAnio * 100 + pMes;

                if (currentVal < startVal || currentVal > endVal) return false;
            }

            // Filter by Ramo classification (supports comma-separated values)
            if (ramoFilter) {
                const ramos = ramoFilter.split(',');
                const producto = String(p['Producto'] || '');
                if (!ramos.includes(getRamo(producto))) return false;
            }

            return true;
        }).map(p => {
            const fAltaStr = p['F. Alta'] || p['F.Efecto'] || '';
            const fAnulaStr = p['F.Anulación'] || '';
            const estado = p['Estado'] || '';
            let diasVida = 0;

            if (fAltaStr) {
                try {
                    const [dE, mE, yE] = fAltaStr.split('/').map(Number);
                    const dateStart = new Date(yE, mE - 1, dE);

                    if (!isNaN(dateStart.getTime())) {
                        let dateEnd = new Date(); // Default for active

                        if (fAnulaStr) {
                            const [dA, mA, yA] = fAnulaStr.split('/').map(Number);
                            dateEnd = new Date(yA, mA - 1, dA);
                        }

                        if (!isNaN(dateEnd.getTime())) {
                            const diffTime = dateEnd.getTime() - dateStart.getTime();
                            diasVida = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                        }
                    }
                } catch (e) {
                    console.error("Error calculating life days", e);
                }
            }

            return {
                poliza: p['NºPóliza'] || p['Poliza'] || 'N/A',
                estado: p['Estado'] || 'N/A',
                tomador: p['Tomador'] || 'N/A',
                producto: p['Producto'] || 'N/A',
                fechaEfecto: p['F.Efecto'] || '',
                fechaAnulacion: fAnulaStr,
                diasVida,
                dni: p['NIF/CIF Tomador'] || 'N/A',
                primas: parseFloat(String(p['P.Produccion'] || '0').replace(',', '.')) || 0,
                cartera: parseFloat(String(p['P.Cartera'] || '0').replace(',', '.')) || 0,
                compania: p['Abrev.Cía'] || 'N/A',
                ente: getPolizaEnteName(p) || 'Desconocido'
            };
        });

        return NextResponse.json({
            count: filteredPolizas.length,
            polizas: filteredPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch policy list' }, { status: 500 });
    }
}
