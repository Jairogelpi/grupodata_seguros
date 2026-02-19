import { NextResponse } from 'next/server';
import { getEntes, addLink, getLinks, removeLink } from '@/lib/registry';

export async function POST(request: Request) {
    try {
        const { asesor, enteCode } = await request.json();

        if (!asesor || !enteCode) {
            return NextResponse.json({ error: 'Missing asesor or enteCode' }, { status: 400 });
        }

        const entesData = await getEntes();
        const enteRow = entesData.find((row: any) => String(row['Código']) === String(enteCode));

        if (!enteRow) {
            return NextResponse.json({ error: 'Código de Ente no existe' }, { status: 404 });
        }

        const enteName = enteRow['Nombre'] || 'Desconocido';
        const formattedEnte = `${enteName} - ${enteCode}`;

        await addLink({ ASESOR: asesor, ENTE: formattedEnte });

        return NextResponse.json({ success: true, message: 'Enlazado correctamente' });

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
            return NextResponse.json({ error: 'Vínculo no encontrado' }, { status: 404 });
        }

        await removeLink(asesor, String(targetLink['ENTE']));

        return NextResponse.json({ success: true, message: 'Desvinculado correctamente' });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to unlink' }, { status: 500 });
    }
}
