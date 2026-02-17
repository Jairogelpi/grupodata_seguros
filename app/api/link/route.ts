import { NextResponse } from 'next/server';
import { getEntes, addLink } from '@/lib/registry';

export async function POST(request: Request) {
    try {
        const { asesor, enteCode } = await request.json();

        if (!asesor || !enteCode) {
            return NextResponse.json({ error: 'Missing asesor or enteCode' }, { status: 400 });
        }

        // 1. Validate Ente Code exists and get Name
        const entesData = await getEntes();

        // Check if code exists in column 'Código'
        const enteRow = entesData.find((row: any) => String(row['Código']) === String(enteCode));

        if (!enteRow) {
            return NextResponse.json({ error: 'Código de Ente no existe' }, { status: 404 });
        }

        const enteName = enteRow['Nombre'] || 'Desconocido';
        const formattedEnte = `${enteName} - ${enteCode}`;

        // 2. Append to Link Registry
        await addLink({ ASESOR: asesor, ENTE: formattedEnte });

        return NextResponse.json({ success: true, message: 'Enlazado correctamente' });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to link' }, { status: 500 });
    }
}
