import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');
        const ramoParam = searchParams.get('ramo');
        const productParam = searchParams.get('producto');
        const anioParam = searchParams.get('anio');
        const mesParam = searchParams.get('mes');
        const startYearParam = searchParams.get('startYear');
        const startMonthParam = searchParams.get('startMonth');
        const endYearParam = searchParams.get('endYear');
        const endMonthParam = searchParams.get('endMonth');
        const periodsParam = searchParams.get('periods');
        const periodsFilter = periodsParam ? periodsParam.split(',').map(Number) : null;

        const ramoFilter = ramoParam ? ramoParam.split(',') : null;
        const productFilter = productParam ? productParam.split(',') : null;
        const targetAnio = anioParam ? parseInt(anioParam) : null;
        const targetMes = mesParam ? parseInt(mesParam) : null;
        const startYear = startYearParam ? parseInt(startYearParam) : null;
        const startMonth = startMonthParam ? parseInt(startMonthParam) : null;
        const endYear = endYearParam ? parseInt(endYearParam) : null;
        const endMonth = endMonthParam ? parseInt(endMonthParam) : null;

        if (!enteName) {
            return NextResponse.json({ error: 'Falta el parámetro ente' }, { status: 400 });
        }

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

        // Helper: calculate days between two Spanish-format dates
        const calcDiasVigor = (fEfecto: string, fAnula: string): number | null => {
            if (!fEfecto || !fAnula) return null;
            try {
                const [dE, mE, yE] = fEfecto.split('/').map(Number);
                const [dA, mA, yA] = fAnula.split('/').map(Number);
                const dateE = new Date(yE, mE - 1, dE);
                const dateA = new Date(yA, mA - 1, dA);
                if (!isNaN(dateE.getTime()) && !isNaN(dateA.getTime())) {
                    return Math.ceil(Math.abs(dateA.getTime() - dateE.getTime()) / (1000 * 60 * 60 * 24));
                }
            } catch { }
            return null;
        };

        // 3. Aggregate Monthly Data with retention + product mix
        interface MonthlyBucket {
            anio: number;
            mes: number;
            primas: number;
            polizas: number;
            anuladas: number;
            enVigor: number;
            suspension: number;
            anulacionesTempranas: number; // < 180 days
        }

        const monthlyStats = new Map<string, MonthlyBucket>();
        const productMix = new Map<string, { primas: number; polizas: number }>();
        const ramosMix = new Map<string, { primas: number; polizas: number }>();

        polizas.forEach(p => {
            const name = getPolizaEnteName(p);
            if (name !== enteName) return;

            const anio = parseInt(p['AÑO_PROD']);
            const mes = parseInt(p['MES_Prod']);
            if (isNaN(anio) || isNaN(mes)) return;

            // Apply Filters (Before Aggregation)
            const producto = String(p['Producto'] || 'Sin Producto');
            const currentVal = anio * 100 + mes;

            // 3.1. ALWAYS Initialize bucket (regardless of filters)
            const key = `${anio}-${String(mes).padStart(2, '0')}`;
            if (!monthlyStats.has(key)) {
                monthlyStats.set(key, { anio, mes, primas: 0, polizas: 0, anuladas: 0, enVigor: 0, suspension: 0, anulacionesTempranas: 0 });
            }

            // 3.2. Apply Ramo/Product Filters EARLY (for aggregation)
            if (ramoFilter) {
                const r = getRamo(producto);
                if (!ramoFilter.includes(r)) return;
            }
            if (productFilter) { // Assuming productFilter exists from searchParams
                if (!productFilter.includes(producto)) return;
            }

            const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;
            const estado = String(p['Estado'] || '').toUpperCase();

            // Aggregation into monthly buckets (now filtered by Ramo/Product)
            const stats = monthlyStats.get(key)!;
            stats.primas += primas;
            stats.polizas += 1;

            if (estado.includes('ANULADA')) {
                stats.anuladas += 1;
                const dias = calcDiasVigor(String(p['F.Efecto'] || ''), String(p['F.Anulación'] || ''));
                if (dias !== null && dias < 180) {
                    stats.anulacionesTempranas += 1;
                }
            } else if (estado.includes('VIGOR')) {
                stats.enVigor += 1;
            } else if (estado.includes('SUSPENSIÓN') || estado.includes('SUSPENSION')) {
                stats.suspension += 1;
            }

            // 3.3. Period Filters for Mix and Global stats ONLY
            let passPeriodFilter = true;
            if (periodsFilter && periodsFilter.length > 0) {
                if (!periodsFilter.includes(currentVal)) passPeriodFilter = false;
            } else {
                if (targetAnio && anio !== targetAnio) passPeriodFilter = false;
                if (targetMes && mes !== targetMes) passPeriodFilter = false;

                if (startYear !== null && startMonth !== null) {
                    const startVal = startYear * 100 + startMonth;
                    if (currentVal < startVal) passPeriodFilter = false;
                }
                if (endYear !== null && endMonth !== null) {
                    const endVal = endYear * 100 + endMonth;
                    if (currentVal > endVal) passPeriodFilter = false;
                }
            }

            if (!passPeriodFilter) return;

            // Product/Ramo mix aggregation
            const ramo = producto;
            if (!productMix.has(ramo)) {
                productMix.set(ramo, { primas: 0, polizas: 0 });
            }
            const pm = productMix.get(ramo)!;
            pm.primas += primas;
            pm.polizas += 1;

            const ramoName = getRamo(producto);
            if (!ramosMix.has(ramoName)) {
                ramosMix.set(ramoName, { primas: 0, polizas: 0 });
            }
            const rm = ramosMix.get(ramoName)!;
            rm.primas += primas;
            rm.polizas += 1;
        });

        // 4. Sort and return
        const evolution = Array.from(monthlyStats.values())
            .map(s => ({
                ...s,
                ratioRetencion: s.polizas > 0 ? Math.round((s.polizas - s.anuladas) / s.polizas * 100) : 100
            }))
            .sort((a, b) => {
                if (a.anio !== b.anio) return a.anio - b.anio;
                return a.mes - b.mes;
            });

        // Product mix sorted by primas desc
        const productMixArray = Array.from(productMix.entries())
            .map(([producto, data]) => ({ producto, ...data }))
            .sort((a, b) => b.primas - a.primas);

        // 5. Global Stats (Flow in period)
        const globalStats = {
            active: 0,
            suspension: 0,
            totalAnuladas: 0
        };

        // Recalculate globalStats based on those months that passed the period filter
        // We accumulate the flags from the filtered months
        monthlyStats.forEach((s, key) => {
            const [anio, mes] = key.split('-').map(Number);
            const currentVal = anio * 100 + mes;

            let pass = true;
            if (periodsFilter && periodsFilter.length > 0) {
                if (!periodsFilter.includes(currentVal)) pass = false;
            } else {
                if (targetAnio && anio !== targetAnio) pass = false;
                if (targetMes && mes !== targetMes) pass = false;
                if (startYear !== null && startMonth !== null) {
                    if (currentVal < (startYear * 100 + startMonth)) pass = false;
                }
                if (endYear !== null && endMonth !== null) {
                    if (currentVal > (endYear * 100 + endMonth)) pass = false;
                }
            }

            if (pass) {
                globalStats.active += s.enVigor || 0;
                globalStats.suspension += s.suspension || 0;
                globalStats.totalAnuladas += s.anuladas || 0;
            }
        });
        const ramosMixArray = Array.from(ramosMix.entries())
            .map(([ramo, data]) => ({ ramo, ...data }))
            .sort((a, b) => b.primas - a.primas);

        return NextResponse.json({
            ente: enteName,
            evolution,
            globalStats,
            productMix: productMixArray,
            ramosMix: ramosMixArray
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch evolution data' }, { status: 500 });
    }
}
