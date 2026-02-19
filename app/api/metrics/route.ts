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
        const codeToNameMap = new Map<string, string>();
        const codeToAsesorMap = new Map<string, string>();
        const validEnteCodes = new Set<string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            codeToNameMap.set(code, val);
            codeToAsesorMap.set(code, asesor);
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

        // Aggregators for metrics
        let currentPrimas = 0;
        let currentCount = 0;
        let polizasSinEfecto = 0;
        const breakdownMap = new Map<string, { ente: string, primas: number, polizas: number, asesor: string, anulaciones: number }>();
        const asesoresStats = new Map<string, { asesor: string, numEntes: number, totalPrimas: number, numPolizos: number }>();
        const productStats = new Map<string, { producto: string; primas: number; polizas: number; entes: Set<string> }>();
        const estadoStats = new Map<string, { estado: string; primas: number; polizas: number }>();
        const companyStats = new Map<string, { company: string, primas: number, polizas: number, entes: Set<string>, asesores: Set<string> }>();
        const ramoStats = new Map<string, { ramo: string; primas: number; polizas: number; entes: Set<string> }>();
        const cancellationReasons = new Map<string, number>();
        const enteRamosMap = new Map<string, Set<string>>();
        const survivalStats = new Map<string, { totalMonths: number, count: number }>();
        const sinEfectoRamoStats = new Map<string, number>();

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

        asesoresStats.set('Sin Asesor', { asesor: 'Sin Asesor', numEntes: 0, totalPrimas: 0, numPolizos: 0 });
        asesoresOptions.forEach(a => asesoresStats.set(a, { asesor: a, numEntes: 0, totalPrimas: 0, numPolizos: 0 }));

        links.forEach(l => {
            const asesor = String(l['ASESOR'] || 'Sin Asesor');
            const pEnteName = String(l['ENTE']);
            const pEnteParts = pEnteName.split(' - ');
            const code = pEnteParts.length > 1 ? pEnteParts[pEnteParts.length - 1].trim() : pEnteName.trim();
            if (asesoresStats.has(asesor)) asesoresStats.get(asesor)!.numEntes += 1;
            const matchAsesor = comerciales.length === 0 || comerciales.includes(asesor);
            const matchEnte = entesFilter.length === 0 || entesFilter.includes(pEnteName);
            if (matchAsesor && matchEnte) {
                if (!breakdownMap.has(code)) {
                    breakdownMap.set(code, { ente: pEnteName, primas: 0, polizas: 0, asesor: asesor, anulaciones: 0 });
                }
            }
        });

        // 3.5 Deduplicate policies by Number to avoid population inflation (Total Reality)
        const uniquePolizasMap = new Map<string, any>();
        polizas.forEach(p => {
            const num = String(p['NºPóliza'] || 'S/N');
            const estado = String(p['Estado'] || '').toLowerCase();
            const isCancelled = estado.includes('anula') || estado.includes('baja');
            if (!uniquePolizasMap.has(num)) {
                uniquePolizasMap.set(num, p);
            } else if (isCancelled) {
                // Prioritize cancelled version for accurate churn tracking if multiple rows exist
                uniquePolizasMap.set(num, p);
            }
        });

        const deduplicatedPolizas = Array.from(uniquePolizasMap.values());

        const dynAnios = new Set<string>();
        const dynMeses = new Set<string>();
        const dynEstados = new Set<string>();
        const dynAsesores = new Set<string>();
        const dynEntes = new Set<string>();
        const dynRamos = new Set<string>();
        const dynProductos = new Set<string>();

        deduplicatedPolizas.forEach(p => {
            const pAnio = String(p['AÑO_PROD'] || '');
            const pMes = String(p['MES_Prod'] || '');
            const pEstado = String(p['Estado'] || '');
            const producto = String(p['Producto'] || 'Otros');
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

            if (matchMes && matchEstado && matchAsesor && matchEnte && matchRamo && matchProducto) if (pAnio) dynAnios.add(pAnio);
            if (matchAnio && matchEstado && matchAsesor && matchEnte && matchRamo && matchProducto) if (pMes) dynMeses.add(pMes);
            if (matchAnio && matchMes && matchAsesor && matchEnte && matchRamo && matchProducto) if (pEstado) dynEstados.add(pEstado);
            if (matchAnio && matchMes && matchEstado && matchEnte && matchRamo && matchProducto) if (pAsesor) dynAsesores.add(pAsesor);
            if (matchAnio && matchMes && matchEstado && matchAsesor && matchRamo && matchProducto) if (pEnteName) dynEntes.add(pEnteName);
            if (matchAnio && matchMes && matchEstado && matchAsesor && matchEnte && matchProducto) if (ramoName) dynRamos.add(ramoName);
            if (matchAnio && matchMes && matchEstado && matchAsesor && matchEnte && matchRamo) if (producto) dynProductos.add(producto);

            if (!matchAnio || !matchMes || !matchEstado || !matchAsesor || !matchEnte || !matchRamo || !matchProducto) return;
            if (!validEnteCodes.has(code)) return;

            const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;
            const company = String(p['Abrev.Cía'] || 'Desconocida').trim();
            const fAnulacion = p['F.Anulación'];
            const fEfecto = p['F.Efecto'];
            const motAnulacion = String(p['Mot.Anulación'] || '').trim();

            const dateEfecto = parseAnyDate(fEfecto);
            const dateAnula = parseAnyDate(fAnulacion);

            const isCancelled = pEstado.toLowerCase().includes('anula') || pEstado.toLowerCase().includes('baja');
            const isActive = pEstado.toLowerCase().includes('vigor') ||
                pEstado.toLowerCase().includes('pendien') ||
                pEstado.toLowerCase().includes('cartera') ||
                pEstado.toLowerCase().includes('cobro') ||
                pEstado.toLowerCase().includes('suspension');

            if (dateEfecto && dateAnula && dateAnula <= dateEfecto) {
                polizasSinEfecto++;
                sinEfectoRamoStats.set(ramoName, (sinEfectoRamoStats.get(ramoName) || 0) + 1);
            }

            currentPrimas += primas;
            currentCount += 1;

            if (!breakdownMap.has(code)) breakdownMap.set(code, { ente: pEnteName, primas: 0, polizas: 0, asesor: pAsesor, anulaciones: 0 });
            const b = breakdownMap.get(code)!;
            b.primas += primas;
            b.polizas += 1;
            if (fAnulacion || isCancelled) b.anulaciones += 1;

            if ((fAnulacion || isCancelled) && motAnulacion) {
                cancellationReasons.set(motAnulacion, (cancellationReasons.get(motAnulacion) || 0) + 1);
            }

            if (fAnulacion && pAnio && pMes) {
                try {
                    const startYear = parseInt(pAnio);
                    const startMonth = parseInt(pMes);
                    const dateEnd = parseAnyDate(fAnulacion);
                    if (dateEnd && !isNaN(dateEnd.getTime())) {
                        const endYear = dateEnd.getFullYear();
                        const endMonth = dateEnd.getMonth() + 1;
                        const diffMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
                        if (diffMonths >= 0) {
                            if (!survivalStats.has(ramoName)) survivalStats.set(ramoName, { totalMonths: 0, count: 0 });
                            const ss = survivalStats.get(ramoName)!;
                            ss.totalMonths += diffMonths;
                            ss.count += 1;
                        }
                    }
                } catch (e) { }
            }

            const a = asesoresStats.get(pAsesor);
            if (a) { a.totalPrimas += primas; a.numPolizos += 1; }

            if (!productStats.has(producto)) productStats.set(producto, { producto, primas: 0, polizas: 0, entes: new Set() });
            const ps = productStats.get(producto)!;
            ps.primas += primas; ps.polizas += 1; ps.entes.add(code);

            if (!ramoStats.has(ramoName)) ramoStats.set(ramoName, { ramo: ramoName, primas: 0, polizas: 0, entes: new Set() });
            const rs = ramoStats.get(ramoName)!;
            rs.primas += primas; rs.polizas += 1; rs.entes.add(code);

            if (!estadoStats.has(pEstado)) estadoStats.set(pEstado, { estado: pEstado, primas: 0, polizas: 0 });
            const es = estadoStats.get(pEstado)!;
            es.primas += primas; es.polizas += 1;

            if (!companyStats.has(company)) companyStats.set(company, { company, primas: 0, polizas: 0, entes: new Set(), asesores: new Set() });
            const cs = companyStats.get(company)!;
            cs.primas += primas; cs.polizas += 1; cs.entes.add(code);
            if (pAsesor !== 'Sin Asesor') cs.asesores.add(pAsesor);

            if (!enteRamosMap.has(code)) enteRamosMap.set(code, new Set());
            enteRamosMap.get(code)!.add(ramoName);
        });

        const crossSellingCounts = { 1: 0, 2: 0, '3+': 0 };
        const pairFreq = new Map<string, number>(); // Simple association frequency
        let totalEntesWithPolizas = 0, totalRamosCoverage = 0;

        enteRamosMap.forEach((ramos) => {
            totalEntesWithPolizas++;
            const count = ramos.size;
            totalRamosCoverage += count;
            if (count === 1) crossSellingCounts[1]++;
            else if (count === 2) crossSellingCounts[2]++;
            else crossSellingCounts['3+']++;

            // Calculate pairs for NBA argument
            const ramosArr = Array.from(ramos);
            for (let i = 0; i < ramosArr.length; i++) {
                for (let j = i + 1; j < ramosArr.length; j++) {
                    const pair = [ramosArr[i], ramosArr[j]].sort().join(' + ');
                    pairFreq.set(pair, (pairFreq.get(pair) || 0) + 1);
                }
            }
        });

        // STRATEGIC INSIGHTS ENGINE
        // Generate dynamic, context-aware strategies based on current filtered data
        const marketingStrategies = [];

        // 1. Retention Strategy (Priority if Churn is high)
        if (currentCount > 0) {
            let totalAnuladas = 0;
            breakdownMap.forEach(b => totalAnuladas += b.anulaciones);
            const churnRateCalc = (totalAnuladas / currentCount) * 100;

            if (churnRateCalc > 15) { // High Churn Threshold
                const topReasonEntry = Array.from(cancellationReasons.entries()).sort((a, b) => b[1] - a[1])[0];
                const topReason = topReasonEntry ? topReasonEntry[0] : 'Desconocido';
                marketingStrategies.push({
                    type: 'RETENTION',
                    title: 'Alerta de Fuga Crítica',
                    color: 'red',
                    description: `El abandono del **${churnRateCalc.toFixed(1)}%** es alarmante. La causa principal es **"${topReason}"**. Activa un plan de retención urgente para clientes en riesgo.`
                });
            } else if (churnRateCalc > 5) { // Moderate Churn
                marketingStrategies.push({
                    type: 'RETENTION',
                    title: 'Fidelización Preventiva',
                    color: 'amber',
                    description: `El **${churnRateCalc.toFixed(1)}%** de tus pólizas se han cancelado. Contacta a los clientes que han anulado recientemente para entender sus motivos y recuperar parte de la cartera.`
                });
            }
        }

        // 2. Cross-Sell Strategy (The NBA - Next Best Action)
        const entries = Array.from(pairFreq.entries()).sort((a, b) => b[1] - a[1]);
        if (entries.length > 0) {
            const [pair, count] = entries[0];
            const [ramoA, ramoB] = pair.split(' + ');
            const supportA = ramoStats.get(ramoA)?.entes.size || 1;
            const supportB = ramoStats.get(ramoB)?.entes.size || 1;
            const confAtoB = (count / supportA) * 100;
            const confBtoA = (count / supportB) * 100;
            const bestConf = Math.max(confAtoB, confBtoA);
            const source = confAtoB >= confBtoA ? ramoA : ramoB;
            const target = confAtoB >= confBtoA ? ramoB : ramoA;

            marketingStrategies.push({
                type: 'CROSS_SELL',
                title: 'Oportunidad de Venta Cruzada',
                color: 'indigo',
                description: `Tus clientes de **${source}** tienen una alta probabilidad (**${bestConf.toFixed(1)}%**) de contratar **${target}**. Lanza una campaña dirigida a este segmento específico.`
            });
        }

        // 3. Expansion Strategy (Mono-product Users)
        const totalPlus1 = crossSellingCounts[1] + crossSellingCounts[2] + crossSellingCounts['3+'];
        const totalPlus2 = crossSellingCounts[2] + crossSellingCounts['3+'];
        const totalPlus3 = crossSellingCounts['3+'];

        const pctMono = totalPlus1 > 0 ? (crossSellingCounts[1] / totalPlus1) * 100 : 0;

        if (pctMono > 60) {
            marketingStrategies.push({
                type: 'EXPANSION',
                title: 'Potencial de Expansión Masiva',
                color: 'purple',
                description: `El **${pctMono.toFixed(1)}%** de tus clientes tiene un solo producto. Es una base enorme sin explotar. Ofréceles un segundo producto con descuento por vinculación.`
            });
        } else if (pctMono < 40) {
            marketingStrategies.push({
                type: 'EXPANSION',
                title: 'Cartera Muy Vinculada',
                color: 'emerald',
                description: `Excelente trabajo: la mayoría de tus clientes tienen múltiples productos. Enfócate ahora en aumentar el ticket medio con productos premium (Up-selling).`
            });
        } else {
            // Generic fallback if neither extreme
            marketingStrategies.push({
                type: 'EXPANSION',
                title: 'Desarrollo de Cliente',
                color: 'blue',
                description: `Tienes **${crossSellingCounts[1]} clientes** con un solo contrato. Convertir solo al 10% de ellos duplicaría significativamente tu rentabilidad por cliente.`
            });
        }

        // Ensure we have at least 3 items, maybe duplicate generic ones if needed, or add a Pareto one
        if (marketingStrategies.length < 3) {
            // Add Pareto Insight
            const entesSorted = Array.from(breakdownMap.values()).sort((a, b) => b.primas - a.primas);
            const top20Count = Math.ceil(entesSorted.length * 0.2);
            const top20Primas = entesSorted.slice(0, top20Count).reduce((s, c) => s + c.primas, 0);
            const paretoPct = currentPrimas > 0 ? (top20Primas / currentPrimas) * 100 : 0;

            if (paretoPct > 75) {
                marketingStrategies.push({
                    type: 'CONCENTRATION',
                    title: 'Protección de VIPs',
                    color: 'amber',
                    description: `Riesgo de concentración: el 20% de tus clientes genera el **${paretoPct.toFixed(1)}%** de tus ingresos. Asegura su lealtad con un servicio exclusivo.`
                });
            } else {
                marketingStrategies.push({
                    type: 'CONCENTRATION',
                    title: 'Cartera Atomizada',
                    color: 'blue',
                    description: `Tu cartera está bien distribuida (${paretoPct.toFixed(1)}% en Top 20). Esto reduce riesgos. Puedes permitirte ser más agresivo en captación de nuevos nichos.`
                });
            }
        }

        // 4. Fill if still missing (Fallback)
        if (marketingStrategies.length < 3) {
            marketingStrategies.push({
                type: 'GENERAL',
                title: 'Revisión de Cartera',
                color: 'slate',
                description: 'Revisa periódicamente las pólizas sin efecto y contacta a los clientes para reactivación o nueva contratación.'
            });
        }

        const crossSellRatio = totalEntesWithPolizas > 0 ? totalRamosCoverage / totalEntesWithPolizas : 0;

        let totalAnuladas = 0;
        breakdownMap.forEach(b => totalAnuladas += b.anulaciones);
        const churnRate = currentCount > 0 ? (totalAnuladas / currentCount) * 100 : 0;

        let prevPrimas = 0, prevCount = 0, calculateTrend = false;
        if (anios.length === 1 && meses.length === 1) {
            calculateTrend = true;
            const curY = parseInt(anios[0]), curM = parseInt(meses[0]);
            let prevY = curY, prevM = curM - 1;
            if (prevM === 0) { prevM = 12; prevY -= 1; }
            deduplicatedPolizas.forEach(p => {
                if (String(p['AÑO_PROD']) === String(prevY) && String(p['MES_Prod']) === String(prevM)) {
                    const code = getPolizaEnteCode(p);
                    if (!code || !validEnteCodes.has(code)) return;
                    const pAsesor = codeToAsesorMap.get(code) || 'Sin Asesor';
                    const pEnteName = codeToNameMap.get(code) || code;
                    if (estados.length > 0 && !estados.includes(String(p['Estado']))) return;
                    if (comerciales.length > 0 && !comerciales.includes(pAsesor)) return;
                    if (entesFilter.length > 0 && !entesFilter.includes(pEnteName)) return;
                    prevPrimas += (parseFloat(String(p['P.Produccion'] || '0').replace(',', '.')) || 0);
                    prevCount += 1;
                }
            });
        }

        const calculatePercentage = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        // Jump Probabilities (Funnel) - Already calculated above for strategies
        const jumpProbabilities = {
            '1to2': totalPlus1 > 0 ? (totalPlus2 / totalPlus1) * 100 : 0,
            '2to3': totalPlus2 > 0 ? (totalPlus3 / totalPlus2) * 100 : 0
        };

        const entesSortedByPrimas = Array.from(breakdownMap.values()).sort((a, b) => b.primas - a.primas);
        let cumulativePrimasVal = 0;
        const paretoData = entesSortedByPrimas.map((e, idx) => {
            cumulativePrimasVal += e.primas;
            return { ente: e.ente, primas: e.primas, cumulativePct: currentPrimas > 0 ? (cumulativePrimasVal / currentPrimas) * 100 : 0, index: idx + 1 };
        });

        // Advanced metrics update
        const advanced = {
            totalEntes: paretoData.length,
            marketingStrategies,
            jumpProbabilities,
            crossSellingDistribution: crossSellingCounts,
            paretoData: paretoData,
            survivalByRamo: Array.from(survivalStats.entries()).map(([ramo, stats]) => ({
                ramo, avgMonths: stats.count > 0 ? stats.totalMonths / stats.count : 0
            })).sort((a, b) => b.avgMonths - a.avgMonths),
            sinEfectoByRamo: Array.from(sinEfectoRamoStats.entries()).map(([ramo, count]) => ({ ramo, count })).sort((a, b) => b.count - a.count)
        };

        // Enrich Ramos Breakdown with Top Clients and their product mix
        const enrichedRamosBreakdown = Array.from(ramoStats.values()).map(r => {
            const clientsInRamo = Array.from(r.entes).map(code => {
                const b = breakdownMap.get(code);
                const productsArray = Array.from(productStats.values())
                    .filter(ps => ps.entes.has(code))
                    .map(ps => ps.producto);

                let nba = null;
                // Only calculate NBA for mono-product or simple clients to keep it clean
                if (productsArray.length === 1) {
                    const currentProd = productsArray[0];
                    let bestNext = '';
                    let bestConf = 0;
                    let bestSupport = 0;

                    // Search for best pair starting with currentProd
                    Array.from(pairFreq.entries()).forEach(([pair, count]) => {
                        if (pair.includes(currentProd)) {
                            const [pA, pB] = pair.split(' + ');
                            const target = pA === currentProd ? pB : pA;
                            // Calculate confidence: P(Target|Current) = Count(Current+Target) / Count(Current)
                            const supportCurrent = productStats.get(currentProd)?.entes.size || 1;
                            const confidence = (count / supportCurrent) * 100;

                            if (confidence > bestConf) {
                                bestConf = confidence;
                                bestNext = target;
                                bestSupport = count; // Number of clients with this exact pair
                            }
                        }
                    });

                    if (bestNext) {
                        nba = {
                            product: bestNext,
                            confidence: bestConf.toFixed(0),
                            reason: `Patrón en ${bestSupport} clientes`
                        };
                    }
                }

                return {
                    name: codeToNameMap.get(code) || code,
                    primas: b?.primas || 0,
                    products: productsArray,
                    ramosCount: enteRamosMap.get(code)?.size || 0,
                    nba // Add NBA object
                };
            }).sort((a, b) => b.primas - a.primas).slice(0, 5); // Just top 5 for UI performance

            return { ...r, entes: r.entes.size, topClients: clientsInRamo };
        }).sort((a, b) => b.primas - a.primas);

        return NextResponse.json({
            metrics: {
                primasNP: currentPrimas,
                numPolizas: currentCount,
                count: currentCount,
                primasTrend: calculateTrend ? calculatePercentage(currentPrimas, prevPrimas) : 0,
                polizasTrend: calculateTrend ? calculatePercentage(currentCount, prevCount) : 0,
                churnRate,
                crossSellRatio,
                polizasSinEfecto
            },
            advanced,
            filters: {
                anios: Array.from(dynAnios).sort(),
                meses: Array.from(dynMeses).sort((a, b) => parseInt(a) - parseInt(b)),
                estados: Array.from(dynEstados).sort(),
                asesores: Array.from(dynAsesores).sort(),
                entes: Array.from(dynEntes).sort(),
                ramos: Array.from(dynRamos).sort(),
                productos: Array.from(dynProductos).sort()
            },
            breakdown: Array.from(breakdownMap.values()).map(b => ({ ...b, ticketMedio: b.polizas > 0 ? b.primas / b.polizas : 0 })).sort((a, b) => b.primas - a.primas),
            asesoresBreakdown: Array.from(asesoresStats.values()).map(a => ({ asesor: a.asesor, numEntes: a.numEntes, totalPrimas: a.totalPrimas, numPolizas: a.numPolizos, avgPrimas: a.numPolizos > 0 ? a.totalPrimas / a.numPolizos : 0 })).sort((a, b) => b.totalPrimas - a.totalPrimas),
            companiasBreakdown: Array.from(companyStats.values()).map(c => ({ company: c.company, primas: c.primas, polizas: c.polizas, numEntes: c.entes.size, numAsesores: c.asesores.size, ticketMedio: c.polizas > 0 ? c.primas / c.polizas : 0 })).sort((a, b) => b.primas - a.primas),
            productosBreakdown: Array.from(productStats.values()).map(p => ({ ...p, entes: p.entes.size, ticketMedio: p.polizas > 0 ? p.primas / p.polizas : 0 })).sort((a, b) => b.primas - a.primas),
            ramosBreakdown: enrichedRamosBreakdown,
            estadosBreakdown: Array.from(estadoStats.values()).sort((a, b) => b.polizas - a.polizas),
            cancellationReasons: Array.from(cancellationReasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 });
    }
}
