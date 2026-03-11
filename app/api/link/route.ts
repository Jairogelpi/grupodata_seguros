import { NextResponse } from 'next/server';
import { getEntes, addLink, getLinks, removeLink } from '@/lib/registry';
import { getStringCell } from '@/lib/excelRow';
import { invalidateMetricsResponseCache } from '@/lib/metricsResponseCache';
import { invalidateRuntimeDataCache } from '@/lib/storage';

function getEnteCode(row: any): string {
    return getStringCell(row, 'Codigo');
}

export async function POST(request: Request) {
    try {
        const { asesor, enteCode } = await request.json();

        if (!asesor || !enteCode) {
            return NextResponse.json({ error: 'Missing asesor or enteCode' }, { status: 400 });
        }

        const entesData = await getEntes();
        const enteRow = entesData.find((row: any) => getEnteCode(row) === String(enteCode).trim());

        if (!enteRow) {
            return NextResponse.json({ error: 'Codigo de Ente no existe' }, { status: 404 });
        }

        const enteName = String(enteRow['Nombre'] || 'Desconocido');
        const formattedEnte = `${enteName} - ${getEnteCode(enteRow)}`;

        const updatedLinks = await addLink({ ASESOR: asesor, ENTE: formattedEnte });
        invalidateRuntimeDataCache('entes_registrados_asesor.xlsx', 'lista_asesores.xlsx');
        invalidateMetricsResponseCache();

        return NextResponse.json({
            success: true,
            message: 'Enlazado correctamente',
            link: { asesor, ente: formattedEnte },
            totalLinks: updatedLinks.length
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to link' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const asesor = searchParams.get('asesor');
        const enteCode = searchParams.get('enteCode');

        if (!asesor || !enteCode) {
            return NextResponse.json({ error: 'Missing asesor or enteCode' }, { status: 400 });
        }

        const links = await getLinks();
        const targetLink = links.find(l =>
            String(l['ASESOR']) === asesor && String(l['ENTE']).endsWith(enteCode)
        );

        if (!targetLink) {
            return NextResponse.json({ error: 'Vinculo no encontrado' }, { status: 404 });
        }

        await removeLink(asesor, String(targetLink['ENTE']));
        invalidateRuntimeDataCache('entes_registrados_asesor.xlsx');
        invalidateMetricsResponseCache();

        return NextResponse.json({ success: true, message: 'Desvinculado correctamente' });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to unlink' }, { status: 500 });
    }
}
