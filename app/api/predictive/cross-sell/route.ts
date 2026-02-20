import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

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

        const asesorFilter = searchParams.get('asesor'); // Legacy fallback

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks()
        ]);

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

        // 3. Robust Date Parsing and Entity Linking (aligned with metrics/route.ts)
        const parseAnyDate = (val: any) => {
            if (!val) return null;
            if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
            const parts = String(val).split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month - 1, day);
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const getPolizaEnteCode = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            if (validEnteCodes.has(codeFromEnte)) return codeFromEnte;
            if (validEnteCodes.has(codeDirect)) return codeDirect;
            return null;
        };

        // 3.5 Track unique policy numbers to provide total policy count
        const uniquePoliciesInFilters = new Set<string>();
        const tomadorTransactions = new Map<string, { ramo: string, date: Date }[]>();

        polizas.forEach(p => {
            const finalCode = getPolizaEnteCode(p);
            if (!finalCode) return;

            const asesor = codeToAsesorMap.get(finalCode) || 'Sin Asesor';
            const enteName = codeToNameMap.get(finalCode) || finalCode;
            const tomador = String(p['Tomador'] || '').trim() || enteName; // Default to Ente if no Tomador
            const pAnio = String(p['AÑO_PROD'] || '');
            const pMes = String(p['MES_Prod'] || '');
            const pEstado = String(p['Estado'] || '');

            // Combined filtering
            const matchAsesor = comerciales.length === 0 || comerciales.includes(asesor) || (asesorFilter === asesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(enteName);
            const matchAnio = anios.length === 0 || anios.includes(pAnio);
            const matchMes = meses.length === 0 || meses.includes(pMes);
            const matchEstado = estados.length === 0 || estados.includes(pEstado);

            if (!matchAsesor || !matchEnte || !matchAnio || !matchMes || !matchEstado) return;

            // Count this unique policy
            uniquePoliciesInFilters.add(String(p['NºPóliza'] || Math.random().toString()));

            const producto = String(p['Producto'] || '');
            const ramo = getRamo(producto);
            // Sequential mining needs the earliest possible date for this branch for the customer
            const fEfecto = parseAnyDate(p['F.Efecto']);

            if (!tomadorTransactions.has(tomador)) {
                tomadorTransactions.set(tomador, []);
            }
            if (fEfecto) {
                tomadorTransactions.get(tomador)!.push({ ramo, date: fEfecto });
            }
        });

        const totalTransactions = tomadorTransactions.size;
        const totalPolizas = uniquePoliciesInFilters.size;
        if (totalTransactions === 0) return NextResponse.json({ rules: [], stats: { totalTransactions: 0, totalPolizas: 0 } });

        // 4. Counts for Statistical Signifance (Contingency Table)
        const ramoFrequencies = new Map<string, number>();
        const sequentialFreq = new Map<string, number>(); // "A -> B" where Date(B) >= Date(A)

        tomadorTransactions.forEach((history) => {
            // Sort by date to define sequence
            const sorted = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            const uniqueRamosForThisEnte = new Set(sorted.map(s => s.ramo));

            uniqueRamosForThisEnte.forEach(r => ramoFrequencies.set(r, (ramoFrequencies.get(r) || 0) + 1));

            // Find unique sequential pairs for this customer
            const pairsFound = new Set<string>();
            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const rA = sorted[i].ramo;
                    const rB = sorted[j].ramo;
                    if (rA === rB) continue;

                    const pairKey = `${rA} -> ${rB}`;
                    pairsFound.add(pairKey);
                }
            }
            pairsFound.forEach(key => sequentialFreq.set(key, (sequentialFreq.get(key) || 0) + 1));
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
            const isSignificant = chiSquare > 2.71; // Lowered to p < 0.10 for small business datasets

            if (lift > 1.2 && confidence > 0.05 && isSignificant) {
                // Find target customers: Have Ramo A, never had Ramo B
                const targetTomadores: string[] = [];
                tomadorTransactions.forEach((history, tomador) => {
                    const ramos = new Set(history.map(h => h.ramo));
                    if (ramos.has(ramoA) && !ramos.has(ramoB)) {
                        targetTomadores.push(tomador);
                    }
                });

                rules.push({
                    antecedent: [ramoA],
                    consequent: ramoB,
                    support,
                    confidence,
                    lift,
                    chiSquare,
                    pVal: isSignificant ? '< 0.05' : '> 0.05',
                    count: observedAB,
                    totalA: countA,
                    targets: targetTomadores // Show all targets as requested
                });
            }
        });

        const sortedRules = rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);

        return NextResponse.json({
            rules: sortedRules,
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
