import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks, getEntes } from '@/lib/registry';
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

        const comerciales = parseParam(searchParams.get('comercial')); // Asesor list
        const anios = parseParam(searchParams.get('anio'));
        const meses = parseParam(searchParams.get('mes'));
        const estados = parseParam(searchParams.get('estado'));
        const entesFilter = parseParam(searchParams.get('ente'));
        const ramosFilter = parseParam(searchParams.get('ramo'));
        const productosFilter = parseParam(searchParams.get('producto'));

        // 1. Read Data (All sources use hybrid storage: disk in dev, Blob in prod)
        const [polizas, links, asesoresList, entesData] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
            readData('lista_asesores.xlsx'),
            getEntes(),
        ]);

        // 2. Collect Base Asesor List
        const asesoresOptions = asesoresList.map(a => a['ASESOR']).filter(Boolean).sort();

        // 3. Performance Indexing
        // Map: Ente Code -> Full Display Name (from registry)
        const codeToNameMap = new Map<string, string>();
        // Map: Ente Code -> Asesor Name
        const codeToAsesorMap = new Map<string, string>();
        // Set of valid Ente codes present in our registry
        const validEnteCodes = new Set<string>();

        // Build Index from links
        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            codeToNameMap.set(code, val);
            codeToAsesorMap.set(code, asesor);
            validEnteCodes.add(code);
        });

        // Helper to get Ente Code from policy (validating against registry)
        const getPolizaEnteCode = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            if (validEnteCodes.has(codeFromEnte)) return codeFromEnte;
            if (validEnteCodes.has(codeDirect)) return codeDirect;
            return null;
        };

        // Aggregators for metrics
        let currentPrimas = 0;
        let currentCount = 0;
        const breakdownMap = new Map<string, { ente: string, primas: number, polizas: number, asesor: string, anulaciones: number }>();
        const asesoresStats = new Map<string, { asesor: string, numEntes: number, totalPrimas: number, numPolizos: number }>();
        const productStats = new Map<string, { producto: string, primas: number, polizas: number }>();
        const estadoStats = new Map<string, { estado: string, primas: number, polizas: number }>();
        const companyStats = new Map<string, { company: string, primas: number, polizas: number, entes: Set<string>, asesores: Set<string> }>();
        const ramoStats = new Map<string, { ramo: string, primas: number, polizas: number }>();
        const cancellationReasons = new Map<string, number>();

        // Pre-fill asesores from the registry to ensure they all appear in base lists if needed
        asesoresOptions.forEach(a => asesoresStats.set(a, { asesor: a, numEntes: 0, totalPrimas: 0, numPolizos: 0 }));
        links.forEach(l => {
            const asesor = String(l['ASESOR']);
            const pEnteName = String(l['ENTE']);
            const pEnteParts = pEnteName.split(' - ');
            const code = pEnteParts.length > 1 ? pEnteParts[pEnteParts.length - 1].trim() : pEnteName.trim();

            if (asesoresStats.has(asesor)) asesoresStats.get(asesor)!.numEntes += 1;

            // Pre-fill breakdownMap with all linked entes that match filters
            const matchAsesor = comerciales.length === 0 || comerciales.includes(asesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(pEnteName);
            if (matchAsesor && matchEnte) {
                if (!breakdownMap.has(code)) {
                    breakdownMap.set(code, { ente: pEnteName, primas: 0, polizas: 0, asesor: asesor, anulaciones: 0 });
                }
            }
        });

        // Sets for Dynamic Filter Options (Cross-Filtering)
        const dynAnios = new Set<string>();
        const dynMeses = new Set<string>();
        const dynEstados = new Set<string>();
        const dynAsesores = new Set<string>();
        const dynEntes = new Set<string>();

        // Main Loop: Single pass for stats and cross-filtering options
        polizas.forEach(p => {
            const pAnio = String(p['AÑO_PROD'] || '');
            const pMes = String(p['MES_Prod'] || '');
            const pEstado = String(p['Estado'] || '');
            const producto = String(p['Producto'] || 'Otros'); // Need product for ramo check
            const ramoName = getRamo(producto);
            const code = getPolizaEnteCode(p);

            if (!code) return;

            const pAsesor = codeToAsesorMap.get(code) || 'Sin Asesor';
            const pEnteName = codeToNameMap.get(code) || code;

            const matchAnio = anios.length === 0 || anios.includes(pAnio);
            const matchMes = meses.length === 0 || meses.includes(pMes);
            const matchEstado = estados.length === 0 || estados.includes(pEstado);
            const matchAsesor = comerciales.length === 0 || comerciales.includes(pAsesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(pEnteName);
            const matchRamo = ramosFilter.length === 0 || ramosFilter.includes(ramoName);
            const matchProducto = productosFilter.length === 0 || productosFilter.includes(producto);

            // Cross-Filtering logic: Update options for each filter independently
            if (matchMes && matchEstado && matchAsesor && matchEnte && matchRamo && matchProducto) {
                if (pAnio) dynAnios.add(pAnio);
            }
            if (matchAnio && matchEstado && matchAsesor && matchEnte && matchRamo && matchProducto) {
                if (pMes) dynMeses.add(pMes);
            }
            if (matchAnio && matchMes && matchAsesor && matchEnte && matchRamo && matchProducto) {
                if (pEstado) dynEstados.add(pEstado);
            }
            if (matchAnio && matchMes && matchEstado && matchEnte && matchRamo && matchProducto) {
                if (pAsesor) dynAsesores.add(pAsesor);
            }
            if (matchAnio && matchMes && matchEstado && matchAsesor && matchRamo && matchProducto) {
                if (pEnteName) dynEntes.add(pEnteName);
            }

            // Metrics application: Must match ALL filters
            if (!matchAnio || !matchMes || !matchEstado || !matchAsesor || !matchEnte || !matchRamo || !matchProducto) return;

            const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;
            const company = String(p['Abrev.Cía'] || 'Desconocida').trim();
            const fAnulacion = p['F.Anulación'];
            const motAnulacion = String(p['Mot.Anulación'] || '').trim();

            currentPrimas += primas;
            currentCount += 1;

            if (!breakdownMap.has(code)) {
                breakdownMap.set(code, { ente: pEnteName, primas: 0, polizas: 0, asesor: pAsesor, anulaciones: 0 });
            }
            const b = breakdownMap.get(code)!;
            b.primas += primas;
            b.polizas += 1;
            if (fAnulacion) b.anulaciones += 1;

            if (fAnulacion && motAnulacion) {
                cancellationReasons.set(motAnulacion, (cancellationReasons.get(motAnulacion) || 0) + 1);
            }

            const a = asesoresStats.get(pAsesor);
            if (a) {
                a.totalPrimas += primas;
                a.numPolizos += 1;
            }

            if (!productStats.has(producto)) productStats.set(producto, { producto, primas: 0, polizas: 0 });
            const ps = productStats.get(producto)!;
            ps.primas += primas;
            ps.polizas += 1;

            // Ramo (depth 1) aggregation
            if (!ramoStats.has(ramoName)) ramoStats.set(ramoName, { ramo: ramoName, primas: 0, polizas: 0 });
            const rs = ramoStats.get(ramoName)!;
            rs.primas += primas;
            rs.polizas += 1;

            if (!estadoStats.has(pEstado)) estadoStats.set(pEstado, { estado: pEstado, primas: 0, polizas: 0 });
            const es = estadoStats.get(pEstado)!;
            es.primas += primas;
            es.polizas += 1;

            if (!companyStats.has(company)) companyStats.set(company, { company, primas: 0, polizas: 0, entes: new Set(), asesores: new Set() });
            const cs = companyStats.get(company)!;
            cs.primas += primas;
            cs.polizas += 1;
            cs.entes.add(code);
            if (pAsesor !== 'Sin Asesor') cs.asesores.add(pAsesor);
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
                const code = getPolizaEnteCode(p);
                if (!code) return;

                const pAsesor = codeToAsesorMap.get(code) || 'Sin Asesor';
                const pEnteName = codeToNameMap.get(code) || code;

                if (String(p['AÑO_PROD']) !== String(prevY)) return;
                if (String(p['MES_Prod']) !== String(prevM)) return;
                if (estados.length > 0 && !estados.includes(String(p['Estado']))) return;
                if (comerciales.length > 0 && !comerciales.includes(pAsesor)) return;
                if (entesFilter.length > 0 && !entesFilter.includes(pEnteName)) return;

                const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
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
            filters: {
                anios: Array.from(dynAnios).sort(),
                meses: Array.from(dynMeses).sort((a, b) => parseInt(a) - parseInt(b)),
                estados: Array.from(dynEstados).sort(),
                asesores: Array.from(dynAsesores).sort(),
                entes: Array.from(dynEntes).sort()
            },
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
            productosBreakdown: Array.from(productStats.values()).map(p => ({
                ...p,
                ticketMedio: p.polizas > 0 ? p.primas / p.polizas : 0
            })).sort((a, b) => b.primas - a.primas),
            ramosBreakdown: Array.from(ramoStats.values()).sort((a, b) => b.primas - a.primas),
            estadosBreakdown: Array.from(estadoStats.values()).sort((a, b) => b.polizas - a.polizas),
            cancellationReasons: Array.from(cancellationReasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 });
    }
}
