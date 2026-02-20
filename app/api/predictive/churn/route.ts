import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getRamo } from '@/lib/ramos';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

const parseAnyDate = (val: any) => {
    if (!val) return null;
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
    const parts = String(val).split(/[/-]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            // Handle 2-digit years if necessary, but assume 4-digit for now
            return new Date(year, month - 1, day);
        }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Helper to parse comma-separated params into arrays, handling 'Todos'
        const parseParam = (param: string | null) => {
            if (!param || param === 'Todos') return [];
            return param.split(',').map(s => s.trim()).filter(Boolean);
        };

        const comerciales = parseParam(searchParams.get('comercial'));
        const anios = parseParam(searchParams.get('anio'));
        const meses = parseParam(searchParams.get('mes'));
        const estados = parseParam(searchParams.get('estado'));
        const entesFilter = parseParam(searchParams.get('ente'));

        const [polizasRaw, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks()
        ]);

        // 0. Index Registry for Ente Filtering (Consistent with metrics/route.ts)
        const codeToAsesorMap = new Map<string, string>();
        const codeToNameMap = new Map<string, string>();
        const validEnteCodes = new Set<string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            codeToAsesorMap.set(code, asesor);
            codeToNameMap.set(code, val);
            validEnteCodes.add(code);
        });

        const getPolizaEnteCode = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            if (validEnteCodes.has(codeFromEnte)) return codeFromEnte;
            if (validEnteCodes.has(codeDirect)) return codeDirect;
            return null;
        };

        // Filter policies to only include those linked to a valid Ente AND match active filters
        const polizas = polizasRaw.filter(p => {
            const code = getPolizaEnteCode(p);
            if (!code) return false;

            const asesor = codeToAsesorMap.get(code) || 'Sin Asesor';
            const enteName = codeToNameMap.get(code) || code;
            const pAnio = String(p['AÑO_PROD'] || '');
            const pMes = String(p['MES_Prod'] || '');
            const pEstado = String(p['Estado'] || '');

            const matchAsesor = comerciales.length === 0 || comerciales.includes(asesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(enteName);
            const matchAnio = anios.length === 0 || anios.includes(pAnio);
            const matchMes = meses.length === 0 || meses.includes(pMes);
            const matchEstado = estados.length === 0 || estados.includes(pEstado);

            return matchAsesor && matchEnte && matchAnio && matchMes && matchEstado;
        });

        // 1. Unique-ify policies by Number to avoid population inflation
        const uniquePolizasMap = new Map<string, any>();
        polizas.forEach(p => {
            const num = String(p['NºPóliza'] || 'S/N');
            const estado = String(p['Estado'] || '').toLowerCase();
            const isCancelled = estado.includes('anula') || estado.includes('baja');

            if (!uniquePolizasMap.has(num)) {
                uniquePolizasMap.set(num, p);
            } else {
                // If we find a version of the policy that is cancelled, that's the one we care about for churn stats
                if (isCancelled) uniquePolizasMap.set(num, p);
            }
        });

        const uniquePolizas = Array.from(uniquePolizasMap.values());

        const cancelled = uniquePolizas.filter(p => {
            const estado = String(p['Estado'] || '').toLowerCase();
            return estado.includes('anula') || estado.includes('baja');
        });

        const active = uniquePolizas.filter(p => {
            const estado = String(p['Estado'] || '').toLowerCase();
            // Active is basically anything that isn't cancelled and isn't a future/test record
            return estado.includes('vigor') || estado.includes('pendien') || estado.includes('cartera') || estado.includes('cobro') || estado.includes('suspension');
        });

        if (uniquePolizas.length === 0 || active.length === 0) {
            // Return dummy stats instead of empty to avoid UI "Not Working" feeling if data is scarce
            return NextResponse.json({
                riskList: [],
                stats: {
                    totalActive: active.length,
                    avgChurn: cancelled.length / (uniquePolizas.length || 1),
                    atHighRisk: 0
                }
            });
        }

        // 2. Analyze Factors in Cancelled Policies
        const stats = {
            ramo: new Map<string, { total: number, cancelled: number }>(),
            compania: new Map<string, { total: number, cancelled: number }>(),
            seniority: new Map<string, { total: number, cancelled: number }>(),
            pago: new Map<string, { total: number, cancelled: number }>()
        };

        const totalPop = uniquePolizas.length;

        uniquePolizas.forEach(p => {
            const ramo = getRamo(String(p['Producto'] || ''));
            const cia = String(p['Abrev.Cía'] || p['Compañía'] || 'Otros');
            const estado = String(p['Estado'] || '').toLowerCase();
            // CRITICAL: Must use the exact same filter as 'cancelled' above
            const isCancelled = estado.includes('anula') || estado.includes('baja');

            // Seniority logic (months between Effekt and current or Cancel date)
            const dateEfecto = parseAnyDate(p['F.Efecto']);
            const dateAnula = parseAnyDate(p['F.Anulación']);
            const now = new Date();
            let seniorityRange = 'Desconocido';

            if (dateEfecto) {
                const endDate = isCancelled ? (dateAnula || now) : now;
                const months = (endDate.getTime() - dateEfecto.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                if (months < 12) seniorityRange = '< 1 año';
                else if (months < 24) seniorityRange = '1-2 años';
                else if (months < 60) seniorityRange = '2-5 años';
                else seniorityRange = '> 5 años';
            }

            const pago = String(p['Forma de Pago'] || 'Anual');

            [
                { map: stats.ramo, key: ramo },
                { map: stats.compania, key: cia },
                { map: stats.seniority, key: seniorityRange },
                { map: stats.pago, key: pago }
            ].forEach(s => {
                if (!s.map.has(s.key)) s.map.set(s.key, { total: 0, cancelled: 0 });
                const current = s.map.get(s.key)!;
                current.total++;
                if (isCancelled) current.cancelled++;
            });
        });

        // 3. Score Active Policies with Ultimate "Reality" Logic
        const entePolicyCount = new Map<string, number>();
        const enteHasCanceledBefore = new Set<string>();


        // Build behavioral profile for each Ente including rejected policies
        const rejectedByEnte = new Map<string, { num: string, ramo: string, cia: string, fecha: string }[]>();

        active.forEach(p => {
            const code = String(p['Ente Comercial'] || '');
            entePolicyCount.set(code, (entePolicyCount.get(code) || 0) + 1);
        });

        cancelled.forEach(p => {
            const code = String(p['Ente Comercial'] || '');
            if (code) {
                enteHasCanceledBefore.add(code);
                if (!rejectedByEnte.has(code)) rejectedByEnte.set(code, []);
                const list = rejectedByEnte.get(code)!;
                if (list.length < 5) {
                    list.push({
                        num: String(p['NºPóliza'] || 'S/N'),
                        ramo: getRamo(String(p['Producto'] || '')),
                        cia: String(p['Abrev.Cía'] || p['Compañía'] || 'Otros'),
                        fecha: String(p['F.Anulación'] || p['F.Baja'] || 'Reciente')
                    });
                }
            }
        });

        const avgChurn = cancelled.length / totalPop;

        const getFactorRisk = (map: Map<string, any>, key: string) => {
            const s = map.get(key);
            if (!s || s.total < 3) return { factor: 1.0, rate: avgChurn };
            const catChurn = s.cancelled / s.total;
            return { factor: catChurn / (avgChurn || 0.01), rate: catChurn };
        };

        const riskList = active.map(p => {
            const code = String(p['Ente Comercial'] || '');
            const ramo = getRamo(String(p['Producto'] || ''));
            const cia = String(p['Abrev.Cía'] || p['Compañía'] || 'Otros');
            const prima = parseFloat(String(p['Primas'] || '0').replace(',', '.'));

            const dateEfecto = parseAnyDate(p['F.Efecto']);
            const now = new Date();
            let seniorityRange = 'Desconocido';
            let isNearRenewal = false;

            if (dateEfecto) {
                const monthsTotal = (now.getTime() - dateEfecto.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                if (monthsTotal < 12) seniorityRange = '< 1 año';
                else if (monthsTotal < 24) seniorityRange = '1-2 años';
                else if (monthsTotal < 60) seniorityRange = '2-5 años';
                else seniorityRange = '> 5 años';

                const nextRenewal = new Date(now.getFullYear(), dateEfecto.getMonth(), dateEfecto.getDate());
                if (nextRenewal < now) nextRenewal.setFullYear(now.getFullYear() + 1);
                const daysToRenewal = (nextRenewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                if (daysToRenewal <= 45) isNearRenewal = true;
            }

            const ramoInfo = getFactorRisk(stats.ramo, ramo);
            const ciaInfo = getFactorRisk(stats.compania, cia);
            const seniorityInfo = getFactorRisk(stats.seniority, seniorityRange);
            const pagoInfo = getFactorRisk(stats.pago, String(p['Forma de Pago'] || 'Anual'));

            const contagionRisk = enteHasCanceledBefore.has(code) ? 1.45 : 0.9;
            const renewalPressure = isNearRenewal ? 1.4 : 1.0;
            const count = entePolicyCount.get(code) || 1;
            const loyaltyBonus = count > 3 ? 0.6 : (count > 1 ? 0.8 : 1.35);

            const ramoData = stats.ramo.get(ramo);
            const avgRamoPrima = ramoData ? (active.filter(ap => getRamo(String(ap['Producto'])) === ramo).reduce((s, ap) => s + parseFloat(String(ap['Primas']).replace(',', '.')), 0) / (ramoData.total || 1)) : 100;
            const premiumPressure = prima > (avgRamoPrima * 1.6) ? 1.4 : 1.0;

            const rawScore = (ramoInfo.factor * ciaInfo.factor * seniorityInfo.factor * pagoInfo.factor * contagionRisk * renewalPressure * loyaltyBonus * premiumPressure);
            const probability = Math.min(0.99, avgChurn * rawScore);

            const factors = [
                { name: 'Ramo', impact: ramoInfo.factor },
                { name: 'Compañía', impact: ciaInfo.factor },
                { name: 'Antigüedad', impact: seniorityInfo.factor },
                { name: 'F. Pago', impact: pagoInfo.factor },
                { name: 'Contagio', impact: contagionRisk },
                { name: 'Renovación', impact: renewalPressure },
                { name: 'Mono-ente', impact: loyaltyBonus > 1 ? loyaltyBonus : 0 },
                { name: 'Ticket Alto', impact: premiumPressure > 1 ? premiumPressure : 0 }
            ].filter(f => f.impact > 1.05).sort((a, b) => b.impact - a.impact).slice(0, 3);

            return {
                poliza: String(p['NºPóliza'] || 'S/N'),
                ente: code || 'Ente Desconocido',
                ramo,
                cia,
                seniority: seniorityRange,
                prima,
                pago: String(p['Forma de Pago'] || 'Anual'),
                score: probability,
                factors,
                rejectedPolicies: rejectedByEnte.get(code) || [],
                ramoChurnRate: ramoInfo.rate,
                ciaChurnRate: ciaInfo.rate
            };
        });

        // 4. Return Top Risks
        const sortedRisk = riskList
            .filter(r => r.score > 0.005)
            .sort((a, b) => b.score - a.score);

        return NextResponse.json({
            riskList: sortedRisk,
            stats: {
                avgChurn,
                totalActive: active.length,
                totalPolizas: uniquePolizas.length,
                atHighRisk: sortedRisk.filter(r => r.score > avgChurn * 1.5).length,
                highRiskPct: (sortedRisk.filter(r => r.score > avgChurn * 1.5).length / active.length) * 100
            }
        });

    } catch (error) {
        console.error("Churn API Error:", error);
        return NextResponse.json({ error: 'Failed to generate churn risk' }, { status: 500 });
    }
}
