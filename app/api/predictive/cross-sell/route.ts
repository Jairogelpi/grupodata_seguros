import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const asesorFilter = searchParams.get('asesor');

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks()
        ]);

        // 2. Index Registry for Ente Filtering & Asesor Mapping
        const codeToAsesorMap = new Map<string, string>();
        const validEnteCodes = new Set<string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            codeToAsesorMap.set(code, asesor);
            validEnteCodes.add(code);
        });

        // 3. Group Ramos by Ente with Date (Transactions with Sequence)
        const enteTransactions = new Map<string, { ramo: string, date: Date }[]>();
        const parseAnyDate = (val: any) => {
            if (!val) return null;
            if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        polizas.forEach(p => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');

            let finalCode = null;
            if (validEnteCodes.has(code)) finalCode = code;
            else if (validEnteCodes.has(codeDirect)) finalCode = codeDirect;

            if (!finalCode) return;
            if (asesorFilter && codeToAsesorMap.get(finalCode) !== asesorFilter) return;

            const producto = String(p['Producto'] || '');
            const ramo = getRamo(producto);
            const fEfecto = parseAnyDate(p['F.Efecto']);

            if (!enteTransactions.has(finalCode)) {
                enteTransactions.set(finalCode, []);
            }
            if (fEfecto) {
                enteTransactions.get(finalCode)!.push({ ramo, date: fEfecto });
            }
        });

        const totalTransactions = enteTransactions.size;
        if (totalTransactions === 0) return NextResponse.json({ rules: [], stats: { totalTransactions: 0 } });

        // 4. Counts for Statistical Signifance (Contingency Table)
        const ramoFrequencies = new Map<string, number>();
        const sequentialFreq = new Map<string, number>(); // "A -> B" where Date(B) >= Date(A)

        enteTransactions.forEach((history) => {
            // Sort by date to define sequence
            const sorted = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            const uniqueRamos = new Set(sorted.map(s => s.ramo));

            uniqueRamos.forEach(r => ramoFrequencies.set(r, (ramoFrequencies.get(r) || 0) + 1));

            // Find sequential pairs: Customer had Ramo A, then (or same day) bought Ramo B
            const ramosList = Array.from(uniqueRamos);
            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const rA = sorted[i].ramo;
                    const rB = sorted[j].ramo;
                    if (rA === rB) continue;

                    const pairKey = `${rA} -> ${rB}`;
                    sequentialFreq.set(pairKey, (sequentialFreq.get(pairKey) || 0) + 1);
                }
            }
        });

        // 5. Generate Rules with Sequential Logic and Chi-Square
        const rules: any[] = [];
        const N = totalTransactions;

        sequentialFreq.forEach((observedAB, key) => {
            const [ramoA, ramoB] = key.split(' -> ');
            const countA = ramoFrequencies.get(ramoA) || 0;
            const countB = ramoFrequencies.get(ramoB) || 0;

            if (countA < 5) return; // Minimum support threshold for "reality"

            const confidence = observedAB / countA;
            const support = observedAB / N;
            const expectedAB = (countA * countB) / N;
            const lift = observedAB / expectedAB;

            // Simple Chi-Square for 2x2 table (Simplified)
            // | AB  | A!B  |
            // | !AB | !A!B |
            const a = observedAB; // A and B
            const b = countA - observedAB; // A but not B
            const c = countB - observedAB; // B but not A
            const d = N - (a + b + c); // Neither

            const chiSquare = (N * Math.pow(a * d - b * c, 2)) / ((a + b) * (c + d) * (a + c) * (b + d));
            const isSignificant = chiSquare > 3.84; // p < 0.05 threshold

            if (lift > 1.2 && confidence > 0.1 && isSignificant) {
                rules.push({
                    antecedent: [ramoA],
                    consequent: ramoB,
                    support,
                    confidence,
                    lift,
                    chiSquare,
                    pVal: isSignificant ? '< 0.05' : '> 0.05',
                    count: observedAB,
                    totalA: countA
                });
            }
        });

        const sortedRules = rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);

        return NextResponse.json({
            rules: sortedRules.slice(0, 50),
            stats: {
                totalTransactions,
                avgConfidence: sortedRules.length > 0 ? sortedRules.reduce((sum, r) => sum + r.confidence, 0) / sortedRules.length : 0,
                numRules: sortedRules.length
            }
        });

    } catch (error) {
        console.error("Prediction API Error:", error);
        return NextResponse.json({ error: 'Failed to generate predictions' }, { status: 500 });
    }
}
