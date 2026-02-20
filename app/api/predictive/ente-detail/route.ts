import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';
import { getRamo } from '@/lib/ramos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        const [polizasRaw, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks()
        ]);

        // 1. Identify Ente Name and Asesor
        let name = code;
        let asesor = 'Sin Asesor';

        const link = links.find(l => {
            const val = String(l['ENTE']);
            const parts = val.split(' - ');
            const lCode = parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
            return lCode === code;
        });

        if (link) {
            name = String(link['ENTE']);
            asesor = String(link['ASESOR'] || 'Sin Asesor');
        }

        // 2. Identify Active Portfolio
        const portfolio = polizasRaw.filter((p: any) => {
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const pCodeFromEnte = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            const pCodeDirect = String(p['Código'] || '');
            const pEstado = String(p['Estado'] || '');

            const isMatch = (pCodeFromEnte === code || pCodeDirect === code);
            // Relax state filtering: if it's in the data and linked to the ente, we show it to justify the recommendation
            const pStatus = pEstado.toUpperCase().trim();
            const isExcluded = ['ANULADA', 'CANCELADA', 'BAJA'].includes(pStatus);

            return isMatch && !isExcluded;
        });

        const activeRamos = Array.from(new Set(portfolio.map((p: any) => getRamo(String(p['Producto'] || 'Otros')))));

        return NextResponse.json({
            code,
            name,
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
