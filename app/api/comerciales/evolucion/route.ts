import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const asesorName = searchParams.get('asesor');

        if (!asesorName) {
            return NextResponse.json({ error: 'Falta el parámetro asesor' }, { status: 400 });
        }

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Advisor mapping via Ente Code
        const codeToAsesorMap = new Map<string, string>();
        const validEnteCodes = new Set<string>();

        links.forEach(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const code = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            const asesor = String(l['ASESOR'] || '').trim();
            codeToAsesorMap.set(code, asesor);
            validEnteCodes.add(code);
        });

        const getPolizaAsesor = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            const code = validEnteCodes.has(codeFromEnte) ? codeFromEnte : (validEnteCodes.has(codeDirect) ? codeDirect : null);
            return code ? codeToAsesorMap.get(code) : null;
        };

        const getPolizaEnteCode = (p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const codeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const codeDirect = String(p['Código'] || '');
            return validEnteCodes.has(codeFromEnte) ? codeFromEnte : (validEnteCodes.has(codeDirect) ? codeDirect : null);
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

        // 3. Aggregate Monthly Data
        interface MonthlyBucket {
            anio: number;
            mes: number;
            primas: number;
            polizas: number;
            entesSet: Set<string>;
            anuladas: number;
            enVigor: number;
            suspension: number;
            anulacionesTempranas: number;
        }

        const monthlyStats = new Map<string, MonthlyBucket>();
        const productMix = new Map<string, { primas: number; polizas: number }>();

        polizas.forEach(p => {
            const asesor = getPolizaAsesor(p);
            if (asesor !== asesorName) return;

            const anio = parseInt(p['AÑO_PROD']);
            const mes = parseInt(p['MES_Prod']);
            if (isNaN(anio) || isNaN(mes)) return;

            const key = `${anio}-${String(mes).padStart(2, '0')}`;
            const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;
            const enteCode = getPolizaEnteCode(p) || 'unknown';
            const estado = String(p['Estado'] || '').toUpperCase();
            const producto = String(p['Producto'] || 'Sin Producto');

            if (!monthlyStats.has(key)) {
                monthlyStats.set(key, { anio, mes, primas: 0, polizas: 0, entesSet: new Set(), anuladas: 0, enVigor: 0, suspension: 0, anulacionesTempranas: 0 });
            }
            const stats = monthlyStats.get(key)!;
            stats.primas += primas;
            stats.polizas += 1;
            stats.entesSet.add(enteCode);

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

            // Product mix
            const ramo = producto.replace(/^<[A-Z]>\s*/, '').split('(')[0].trim() || producto;
            if (!productMix.has(ramo)) {
                productMix.set(ramo, { primas: 0, polizas: 0 });
            }
            const pm = productMix.get(ramo)!;
            pm.primas += primas;
            pm.polizas += 1;
        });

        // 4. Sort and return with numEntes + retention
        const evolution = Array.from(monthlyStats.values()).map(s => ({
            anio: s.anio,
            mes: s.mes,
            primas: s.primas,
            polizas: s.polizas,
            entes: s.entesSet.size,
            anuladas: s.anuladas,
            enVigor: s.enVigor,
            suspension: s.suspension,
            anulacionesTempranas: s.anulacionesTempranas,
            ratioRetencion: s.polizas > 0 ? Math.round((s.polizas - s.anuladas) / s.polizas * 100) : 100
        })).sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            return a.mes - b.mes;
        });

        // 5. Global Stats (Stock)
        const globalStats = {
            active: 0,
            suspension: 0,
            totalAnuladas: 0
        };

        polizas.forEach(p => {
            const asesor = getPolizaAsesor(p);
            if (asesor !== asesorName) return;

            const estado = String(p['Estado'] || '').toUpperCase();
            if (estado.includes('VIGOR')) globalStats.active++;
            else if (estado.includes('SUSPENSIÓN') || estado.includes('SUSPENSION')) globalStats.suspension++;
            else if (estado.includes('ANULADA')) globalStats.totalAnuladas++;
        });

        const productMixArray = Array.from(productMix.entries())
            .map(([producto, data]) => ({ producto, ...data }))
            .sort((a, b) => b.primas - a.primas);

        return NextResponse.json({
            asesor: asesorName,
            evolution,
            globalStats,
            productMix: productMixArray
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch advisor evolution data' }, { status: 500 });
    }
}
