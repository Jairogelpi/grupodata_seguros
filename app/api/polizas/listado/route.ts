import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';
import {
    getPolicyAltaDate,
    getPolicyCancellationDate,
    getPolicyCompany,
    getPolicyEffectiveDate,
    getPolicyEnteCode,
    getPolicyEnteCommercial,
    getPolicyHolder,
    getPolicyHolderDocument,
    getPolicyMonth,
    getPolicyNumber,
    getPolicyPremiumValue,
    getPolicyProduct,
    getPolicyState,
    getPolicyYear
} from '@/lib/policyRow';

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
        const targetAnio = searchParams.get('anio');
        const targetMes = searchParams.get('mes');
        const periodsParam = searchParams.get('periods');
        const periodsFilter = periodsParam ? periodsParam.split(',').map(Number) : null;
        const ramoFilter = searchParams.get('ramo'); // Ramo classification filter
        const productoFilter = searchParams.get('producto');
        const companiaFilter = searchParams.get('compania');
        const crossSellFilter = searchParams.get('crossSell'); // Cross-sell count filter (1, 2, 3+)

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
            const enteComercial = getPolicyEnteCommercial(p);
            if (validEnteNames.has(enteComercial)) return enteComercial;

            const codeFromEnte = getPolicyEnteCode(p);
            const codeDirect = getPolicyEnteCode(p);

            return codeToNameMap.get(codeFromEnte) || codeToNameMap.get(codeDirect) || null;
        };

        const getPolizaAsesorName = (p: any) => {
            const name = getPolizaEnteName(p);
            if (!name) return null;
            const link = links.find(l => String(l['ENTE']) === name);
            return link ? String(link['ASESOR'] || '') : null;
        };

        // 2.5 Calculate Cross-Selling (Unique Ramos per Tomador)
        const tomadorRamosMap = new Map<string, Set<string>>();
        polizas.forEach(p => {
            const tomadorDni = getPolicyHolderDocument(p);
            const tomadorName = getPolicyHolder(p);
            const tomadorKey = tomadorDni || tomadorName || 'DESCONOCIDO';

            const producto = getPolicyProduct(p);
            const ramo = getRamo(producto);
            if (tomadorKey && ramo) {
                if (!tomadorRamosMap.has(tomadorKey)) tomadorRamosMap.set(tomadorKey, new Set());
                tomadorRamosMap.get(tomadorKey)!.add(ramo);
            }
        });

        // 3. Filter Policies
        console.log(`[API:Listado] Total polizas from file: ${polizas.length}`);

        const filteredPolizas = polizas.filter(p => {
            const pEnte = getPolizaEnteName(p);

            // GLOBAL FILTER: Ente must be registered in the 'links' list
            if (!pEnte || !validEnteNames.has(pEnte)) return false;

            // Filter by Ente (Specific parameter if provided)
            if (enteName) {
                if (pEnte !== enteName) return false;
            }

            // Filter by Asesor
            if (asesorName) {
                const pAsesor = getPolizaAsesorName(p);
                if (pAsesor !== asesorName) return false;
            }

            // Filter by Estado
            if (estadoFilter) {
                const estado = getPolicyState(p).toUpperCase();
                if (estadoFilter === 'VIGOR' && !estado.includes('VIGOR')) return false;
                if (estadoFilter === 'SUSPENSION' && !estado.includes('SUSPENSI')) return false;
                if (estadoFilter === 'ANULADA' && !estado.includes('ANULADA')) return false;
            }

            // Filter by PeriodSelection (pAnio/pMes used for multiple filters)
            const pAnio = parseInt(getPolicyYear(p), 10);
            const pMes = parseInt(getPolicyMonth(p), 10);
            const currentVal = pAnio * 100 + pMes;

            if (periodsFilter && periodsFilter.length > 0) {
                if (!periodsFilter.includes(currentVal)) return false;
            } else if (targetAnio && targetMes) {
                if (pAnio !== parseInt(targetAnio) || pMes !== parseInt(targetMes)) return false;
            } else if (startYear && startMonth && endYear && endMonth) {
                const startVal = parseInt(startYear) * 100 + parseInt(startMonth);
                const endVal = parseInt(endYear) * 100 + parseInt(endMonth);
                if (currentVal < startVal || currentVal > endVal) return false;
            }

            // Filter by Ramo classification (supports comma-separated values)
            if (ramoFilter) {
                const ramos = ramoFilter.split(',');
                const producto = getPolicyProduct(p);
                if (!ramos.includes(getRamo(producto))) return false;
            }

            // Filter by Producto
            if (productoFilter) {
                const productos = productoFilter.split(',');
                const producto = getPolicyProduct(p);
                if (!productos.includes(producto)) return false;
            }

            // Filter by Compañia
            if (companiaFilter) {
                const companias = companiaFilter.split(',');
                const cia = getPolicyCompany(p) || 'Otros';
                if (!companias.includes(cia)) return false;
            }

            // Filter by Cross-Selling
            if (crossSellFilter) {
                const tomadorDni = getPolicyHolderDocument(p);
                const tomadorName = getPolicyHolder(p);
                const tomadorKey = tomadorDni || tomadorName || 'DESCONOCIDO';

                const ramosCount = tomadorRamosMap.get(tomadorKey)?.size || 0;
                const allowed = crossSellFilter.split(',');

                // Handle "3+" case if needed, but here we just check exact numbers
                // If user sends "3", they might mean 3 or more? Usually it's specific.
                // For simplicity, let's treat "3" as ">= 3" if the user wants "3+"
                const match = allowed.some(val => {
                    if (val === '3+') return ramosCount >= 3;
                    return ramosCount === parseInt(val);
                });
                if (!match) return false;
            }

            return true;
        })

        console.log(`[API:Listado] Policies after filters: ${filteredPolizas.length}`);

        const mappedPolizas = filteredPolizas.map(p => {
            const fAltaStr = getPolicyAltaDate(p) || getPolicyEffectiveDate(p) || '';
            const fAnulaStr = getPolicyCancellationDate(p) || '';
            const estado = getPolicyState(p) || '';
            let diasVida = 0;

            if (fAltaStr) {
                try {
                    const [dE, mE, yE] = String(fAltaStr).split('/').map(Number);
                    const dateStart = new Date(yE, mE - 1, dE);

                    if (!isNaN(dateStart.getTime())) {
                        let dateEnd = new Date(); // Default for active

                        if (fAnulaStr) {
                            const [dA, mA, yA] = String(fAnulaStr).split('/').map(Number);
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
                poliza: getPolicyNumber(p) || 'N/A',
                estado: getPolicyState(p) || 'N/A',
                tomador: getPolicyHolder(p) || 'N/A',
                producto: getPolicyProduct(p) || 'N/A',
                fechaEfecto: getPolicyEffectiveDate(p) || '',
                fechaAnulacion: fAnulaStr,
                diasVida,
                dni: getPolicyHolderDocument(p) || 'N/A',
                primas: getPolicyPremiumValue(p, 'PProduccion', 'P.Produccion'),
                cartera: getPolicyPremiumValue(p, 'PCartera', 'P.Cartera'),
                compania: getPolicyCompany(p) || 'N/A',
                ente: getPolizaEnteName(p) || 'Desconocido',
                ventaCruzada: tomadorRamosMap.get(getPolicyHolderDocument(p) || getPolicyHolder(p) || 'DESCONOCIDO')?.size || 0
            };
        });

        console.log(`[API:Listado] Final mapped policies: ${mappedPolizas.length}`);

        return NextResponse.json({
            count: mappedPolizas.length,
            polizas: mappedPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch policy list', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
