import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';
import { getLinks } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const enteName = searchParams.get('ente');
        const anio = searchParams.get('anio');
        const mes = searchParams.get('mes');

        if (!enteName || !anio || !mes) {
            return NextResponse.json({ error: 'Faltan parámetros (ente, anio, mes)' }, { status: 400 });
        }

        const targetAnio = parseInt(anio);
        const targetMes = parseInt(mes);

        // 1. Read Data
        const [polizas, links] = await Promise.all([
            readData('listado_polizas.xlsx'),
            getLinks(),
        ]);

        // 2. Index Ente Code (Same logic as evolution)
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

        // 3. Filter Policies for this specific month/ente
        const filteredPolizas = polizas.filter(p => {
            const name = getPolizaEnteName(p);
            if (name !== enteName) return false;

            const pAnio = parseInt(p['AÑO_PROD']);
            const pMes = parseInt(p['MES_Prod']);

            return pAnio === targetAnio && pMes === targetMes;
        }).map(p => ({
            poliza: p['Poliza'] || p['Nº Póliza'] || 'N/A',
            fechaEfecto: p['F.Efecto'] || 'N/A',
            producto: p['D.Producto'] || 'N/A',
            ramo: p['D.Ramo'] || 'N/A',
            compania: p['D.Compañia'] || 'N/A',
            primas: parseFloat(String(p['P.Produccion'] || '0').replace(',', '.')) || 0,
            estado: p['Estado'] || 'N/A',
            tomador: p['Nombre Tomador'] || 'N/A',
            dni: p['NIF Tomador'] || 'N/A'
        }));

        return NextResponse.json({
            ente: enteName,
            anio: targetAnio,
            mes: targetMes,
            polizas: filteredPolizas
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch monthly details' }, { status: 500 });
    }
}
