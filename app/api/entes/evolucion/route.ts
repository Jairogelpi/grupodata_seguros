import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');

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

        // 3. Aggregate Monthly Data
        // Map key: "YYYY-MM"
        const monthlyStats = new Map<string, { anio: number, mes: number, primas: number, polizas: number }>();

        polizas.forEach(p => {
            const name = getPolizaEnteName(p);
            if (name !== enteName) return;

            const anio = parseInt(p['AÑO_PROD']);
            const mes = parseInt(p['MES_Prod']);
            if (isNaN(anio) || isNaN(mes)) return;

            const key = `${anio}-${String(mes).padStart(2, '0')}`;
            const pStr = String(p['P.Produccion'] || '0').replace(',', '.');
            const primas = parseFloat(pStr) || 0;

            if (!monthlyStats.has(key)) {
                monthlyStats.set(key, { anio, mes, primas: 0, polizas: 0 });
            }
            const stats = monthlyStats.get(key)!;
            stats.primas += primas;
            stats.polizas += 1;
        });

        // 4. Sort and return
        const evolution = Array.from(monthlyStats.values()).sort((a, b) => {
            if (a.anio !== b.anio) return a.anio - b.anio;
            return a.mes - b.mes;
        });

        return NextResponse.json({
            ente: enteName,
            evolution
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch evolution data' }, { status: 500 });
    }
}
