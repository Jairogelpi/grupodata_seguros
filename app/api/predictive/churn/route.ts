import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getRamo } from '@/lib/ramos';

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
        const polizas = await readData('listado_polizas.xlsx');

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
            seniority: new Map<string, { total: number, cancelled: number }>()
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

            [
                { map: stats.ramo, key: ramo },
                { map: stats.compania, key: cia },
                { map: stats.seniority, key: seniorityRange }
            ].forEach(s => {
                if (!s.map.has(s.key)) s.map.set(s.key, { total: 0, cancelled: 0 });
                const current = s.map.get(s.key)!;
                current.total++;
                if (isCancelled) current.cancelled++;
            });
        });

        // 3. Score Active Policies
        // Factor Weight = (Cancelled in Category / Total in Category) / (Total Cancelled / Total Population)
        const avgChurn = cancelled.length / totalPop;

        const getFactorRisk = (map: Map<string, any>, key: string) => {
            const s = map.get(key);
            if (!s || s.total < 5) return 1.0; // Neutral if not enough data
            const catChurn = s.cancelled / s.total;
            return catChurn / (avgChurn || 0.01); // Probability relative to mean
        };

        const riskList = active.map(p => {
            const ramo = getRamo(String(p['Producto'] || ''));
            const cia = String(p['Abrev.Cía'] || p['Compañía'] || 'Otros');
            const dateEfecto = parseAnyDate(p['F.Efecto']);
            const now = new Date();
            let seniorityRange = 'Desconocido';

            if (dateEfecto) {
                const months = (now.getTime() - dateEfecto.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                if (months < 12) seniorityRange = '< 1 año';
                else if (months < 24) seniorityRange = '1-2 años';
                else if (months < 60) seniorityRange = '2-5 años';
                else seniorityRange = '> 5 años';
            }

            const riskRamo = getFactorRisk(stats.ramo, ramo);
            const riskCia = getFactorRisk(stats.compania, cia);
            const riskSeniority = getFactorRisk(stats.seniority, seniorityRange);

            // Aggregate Score
            const rawScore = (riskRamo * riskCia * riskSeniority);

            // Normalize to a 0-1 probability scale (Approximate)
            // If rawScore = 1, prob = avgChurn
            const probability = Math.min(0.99, avgChurn * rawScore);

            return {
                poliza: String(p['NºPóliza'] || 'S/N'),
                ente: String(p['Ente Comercial'] || 'Cliente Desconocido'),
                ramo,
                cia,
                seniority: seniorityRange,
                score: probability,
                factors: [
                    { name: 'Ramo', impact: riskRamo },
                    { name: 'Compañía', impact: riskCia },
                    { name: 'Antigüedad', impact: riskSeniority }
                ].sort((a, b) => b.impact - a.impact)
            };
        });

        // 4. Return Top Risks
        const sortedRisk = riskList
            .filter(r => r.score > 0.01) // More inclusive threshold
            .sort((a, b) => b.score - a.score);

        return NextResponse.json({
            riskList: sortedRisk,
            stats: {
                avgChurn,
                totalActive: active.length,
                atHighRisk: sortedRisk.filter(r => r.score > avgChurn * 2).length
            }
        });

    } catch (error) {
        console.error("Churn API Error:", error);
        return NextResponse.json({ error: 'Failed to generate churn risk' }, { status: 500 });
    }
}
