import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks, getEntes } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Helper to parse comma-separated params into arrays, handling 'Todos'
        const parseParam = (param: string | null) => {
            if (!param || param === 'Todos') return [];
            return param.split(',').map(s => s.trim()).filter(Boolean);
        };

        const comerciales = parseParam(searchParams.get('comercial')); // Asesor list
        const anios = parseParam(searchParams.get('anio'));
        const meses = parseParam(searchParams.get('mes'));
        const estados = parseParam(searchParams.get('estado'));
        const entesFilter = parseParam(searchParams.get('ente'));

        // 1. Read Data (All sources use hybrid storage: disk in dev, Blob in prod)
        const [polizas, links, asesoresList, entesData] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
            readData('lista_asesores.xlsx'),
            getEntes(),
        ]);

        // 2. Prepare Filter Options (Fast sets)
        const uniqueAnios = Array.from(new Set(polizas.map(p => p['AÑO_PROD']))).filter(Boolean).sort();
        const uniqueMeses = Array.from(new Set(polizas.map(p => p['MES_Prod']))).filter(Boolean).sort();
        const uniqueEstados = Array.from(new Set(polizas.map(p => p['Estado']))).filter(Boolean).sort();
        const asesoresOptions = asesoresList.map(a => a['ASESOR']).filter(Boolean).sort();
        const uniqueEntesOptions = Array.from(new Set(links.map(l => String(l['ENTE']).trim()))).filter(Boolean).sort();

        // 3. Performance Indexing
        // Map: Ente Code -> Display Name
        const codeToNameMap = new Map<string, string>();
        // Map: Ente Code -> Asesor Name
        const codeToAsesorMap = new Map<string, string>();
        // Map: Ente Code -> First Policy Year (DYNAMIC SENIORITY)
        const codeToFirstYearMap = new Map<string, number>();
        // Set: Codes that are actually ENTES (not colaboradores)
        const enteOnlyCodes = new Set<string>();

        // Build Ente Type Index - Exclude Colaboradores to satisfy "Entes no Colaboradores"
        entesData.forEach((e: any) => {
            const code = String(e['Código'] || '').trim();
            const tipo = String(e['Tipo'] || '').toUpperCase().trim();

            // Inclusion logic: Not a collaborator, and not empty
            if (code && !tipo.includes('COLABORADOR')) {
                enteOnlyCodes.add(code);
            }
        });

        // Build Index and Calculate Real Seniority (First Policy Year)
        polizas.forEach((p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const year = parseInt(String(p['AÑO_PROD'] || '0'));

            if (codeFromEnte && year > 1900) {
                const currentMin = codeToFirstYearMap.get(codeFromEnte);
                if (!currentMin || year < currentMin) {
                    codeToFirstYearMap.set(codeFromEnte, year);
                }
            }
        });

        // Build Link Index
        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            codeToNameMap.set(code, val);
            codeToAsesorMap.set(code, asesor);
        });

        // Determine Allowed Codes based on Comercial/Ente filters
        const targetEntesCodes = new Set<string>();
        links.forEach(l => {
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            const enteVal = String(l['ENTE']).trim();
            const parts = enteVal.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : enteVal.trim();

            const matchAsesor = comerciales.length === 0 || comerciales.includes(asesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(enteVal);

            if (matchAsesor && matchEnte) {
                targetEntesCodes.add(code);
            }
        });

        // 4. Optimized Logic: Single Pass
        const currentYearValue = new Date().getFullYear();
        const getTenureLabel = (tenure: number) => {
            if (tenure <= 0) return "Año 0 (Nuevo)";
            if (tenure === 1) return "Año 1";
            if (tenure === 2) return "Año 2";
            return "Año 3+ (Senior)";
        };

        const getPolizaEnteCode = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            return targetEntesCodes.has(codeFromEnte) ? codeFromEnte : (targetEntesCodes.has(codeDirect) ? codeDirect : null);
        };

        // Aggregators
        let currentPrimas = 0;
        let currentCount = 0;
        const breakdownMap = new Map<string, { ente: string, primas: number, polizas: number, asesor: string, anulaciones: number }>();
        const asesoresStats = new Map<string, { asesor: string, numEntes: number, totalPrimas: number, numPolizos: number }>();
        const productStats = new Map<string, { producto: string, primas: number, polizas: number }>();
        const estadoStats = new Map<string, { estado: string, primas: number, polizas: number }>();
        const companyStats = new Map<string, { company: string, primas: number, polizas: number, entes: Set<string>, asesores: Set<string> }>();
        const tenureStats = new Map<string, { label: string, primas: number, polizas: number, countEntes: Set<string> }>();
        const cancellationReasons = new Map<string, number>();

        // Pre-fill asesores with entes count for productivity
        asesoresOptions.forEach(a => asesoresStats.set(a, { asesor: a, numEntes: 0, totalPrimas: 0, numPolizos: 0 }));
        links.forEach(l => {
            const asesor = String(l['ASESOR']);
            if (asesoresStats.has(asesor)) asesoresStats.get(asesor)!.numEntes += 1;
        });

        // Main Loop
        polizas.forEach(p => {
            // Apply Date Filters First
            if (anios.length > 0 && !anios.includes(String(p['AÑO_PROD']))) return;
            if (meses.length > 0 && !meses.includes(String(p['MES_Prod']))) return;
            if (estados.length > 0 && !estados.includes(String(p['Estado']))) return;

            // Apply Ente/Asesor Filter
            const code = getPolizaEnteCode(p);
            if (!code) return;

            // Stats parsing
            let pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;
            const producto = String(p['Producto'] || 'Otros');
            const estado = String(p['Estado'] || 'Otros');
            const company = String(p['Abrev.Cia'] || 'Desconocida').trim();
            const asesor = codeToAsesorMap.get(code) || 'Sin Asesor';
            const fAnulacion = p['F.Anulación'];
            const motAnulacion = String(p['Mot.Anulación'] || '').trim();

            // Global Totals
            currentPrimas += primas;
            currentCount += 1;

            // Breakdown (Ente)
            if (!breakdownMap.has(code)) {
                breakdownMap.set(code, { ente: codeToNameMap.get(code) || code, primas: 0, polizas: 0, asesor, anulaciones: 0 });
            }
            const b = breakdownMap.get(code)!;
            b.primas += primas;
            b.polizas += 1;
            if (fAnulacion) b.anulaciones += 1;

            // Cancellation Reasons
            if (fAnulacion && motAnulacion) {
                cancellationReasons.set(motAnulacion, (cancellationReasons.get(motAnulacion) || 0) + 1);
            }

            // Asesores
            const a = asesoresStats.get(asesor);
            if (a) {
                a.totalPrimas += primas;
                a.numPolizos += 1;
            }

            // Products
            if (!productStats.has(producto)) productStats.set(producto, { producto, primas: 0, polizas: 0 });
            const ps = productStats.get(producto)!;
            ps.primas += primas;
            ps.polizas += 1;

            // States
            if (!estadoStats.has(estado)) estadoStats.set(estado, { estado, primas: 0, polizas: 0 });
            const es = estadoStats.get(estado)!;
            es.primas += primas;
            es.polizas += 1;

            // Companies
            if (!companyStats.has(company)) companyStats.set(company, { company, primas: 0, polizas: 0, entes: new Set(), asesores: new Set() });
            const cs = companyStats.get(company)!;
            cs.primas += primas;
            cs.polizas += 1;
            cs.entes.add(code);
            if (asesor !== 'Sin Asesor') cs.asesores.add(asesor);
        });

        // Trend calculation
        let prevPrimas = 0;
        let prevCount = 0;
        let calculateTrend = false;
        if (anios.length === 1 && meses.length === 1) {
            calculateTrend = true;
            const curY = parseInt(anios[0]);
            const curM = parseInt(meses[0]);
            let prevY = curY;
            let prevM = curM - 1;
            if (prevM === 0) { prevM = 12; prevY -= 1; }

            polizas.forEach(p => {
                if (String(p['AÑO_PROD']) !== String(prevY)) return;
                if (String(p['MES_Prod']) !== String(prevM)) return;
                if (estados.length > 0 && !estados.includes(String(p['Estado']))) return;
                const code = getPolizaEnteCode(p);
                if (!code) return;

                let pStr = String(p['P.Produccion'] || '0').replace(',', '.');
                prevPrimas += (parseFloat(pStr) || 0);
                prevCount += 1;
            });
        }

        const calculatePercentage = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        return NextResponse.json({
            metrics: {
                primasNP: currentPrimas,
                numPolizas: currentCount,
                count: currentCount,
                primasTrend: calculateTrend ? calculatePercentage(currentPrimas, prevPrimas) : 0,
                polizasTrend: calculateTrend ? calculatePercentage(currentCount, prevCount) : 0
            },
            filters: { anios: uniqueAnios, meses: uniqueMeses, estados: uniqueEstados, asesores: asesoresOptions, entes: uniqueEntesOptions },
            breakdown: Array.from(breakdownMap.values()).map(b => ({
                ...b,
                ticketMedio: b.polizas > 0 ? b.primas / b.polizas : 0
            })).sort((a, b) => b.primas - a.primas),
            asesoresBreakdown: Array.from(asesoresStats.values()).map(a => ({
                asesor: a.asesor,
                numEntes: a.numEntes,
                totalPrimas: a.totalPrimas,
                numPolizas: a.numPolizos,
                avgPrimas: a.numEntes > 0 ? a.totalPrimas / a.numEntes : 0
            })).sort((a, b) => b.totalPrimas - a.totalPrimas),
            companiasBreakdown: Array.from(companyStats.values()).map(c => ({
                company: c.company,
                primas: c.primas,
                polizas: c.polizas,
                numEntes: c.entes.size,
                numAsesores: c.asesores.size,
                ticketMedio: c.polizas > 0 ? c.primas / c.polizas : 0
            })).sort((a, b) => b.primas - a.primas),
            productosBreakdown: Array.from(productStats.values()).sort((a, b) => b.primas - a.primas),
            estadosBreakdown: Array.from(estadoStats.values()).sort((a, b) => b.polizas - a.polizas),
            cancellationReasons: Array.from(cancellationReasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 });
    }
}
