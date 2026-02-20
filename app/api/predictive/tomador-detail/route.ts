import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawName = searchParams.get('name');

        if (!rawName) {
            return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 });
        }

        // Remove trailing numbers and parentheses often appended by the UI
        const name = rawName.replace(/\s\(\d+\)$/, '').trim();

        const [polizasRaw, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks()
        ]);

        // 1. Identify Asesor (Fallback to Ente if Tomador code unavailable)
        let asesor = 'Sin Asesor';

        const link = links.find(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const lCode = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            return lCode === name || val === name;
        });

        let finalName = name;
        if (link) {
            finalName = String(link['ENTE']);
            asesor = String(link['ASESOR'] || 'Sin Asesor');
        }

        // 2. Identify Active Portfolio
        const portfolio = polizasRaw.filter((p: any) => {
            const tomadorStr = String(p['Tomador'] || '').trim();
            const enteComercial = String(p['Ente Comercial'] || '').trim();
            const pCodeDirect = String(p['Código'] || '').trim();
            const pEstado = String(p['Estado'] || '');

            // Match if Tomador name matches exactly, OR if no tomador and the ente matches
            const isMatch = (tomadorStr === finalName) ||
                (!tomadorStr && (enteComercial.includes(finalName) || pCodeDirect === finalName));
            // Relax state filtering: if it's in the data and linked to the ente, we show it to justify the recommendation
            const pStatus = pEstado.toUpperCase().trim();
            const isExcluded = ['ANULADA', 'CANCELADA', 'BAJA'].includes(pStatus);

            return isMatch && !isExcluded;
        });

        const activeRamos = Array.from(new Set(portfolio.map((p: any) => getRamo(String(p['Producto'] || 'Otros')))));

        return NextResponse.json({
            name: finalName,
            asesor,
            activeRamos,
            totalActivePolicies: portfolio.length,
            policies: portfolio.map((p: any) => ({
                poliza: String(p['NºPóliza'] || 'S/N'),
                producto: String(p['Producto'] || ''),
                cia: String(p['Abrev.Cía'] || p['Compañía'] || ''),
                prima: parseFloat(String(p['Primas'] || '0').replace(',', '.')),
                ramo: getRamo(String(p['Producto'] || 'Otros'))
            }))
        });

    } catch (error) {
        console.error("Ente Detail API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch ente details' }, { status: 500 });
    }
}
