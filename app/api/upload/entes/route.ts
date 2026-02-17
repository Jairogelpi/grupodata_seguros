import { NextResponse } from 'next/server';
import { writeData } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeData('entes.xlsx', buffer);

        return NextResponse.json({ success: true, message: 'Entes actualizados correctamente' });
    } catch (error: any) {
        console.error('Upload error:', error);
        const msg = error?.message || '';
        if (msg.includes('busy') || msg.includes('locked') || msg.includes('EBUSY')) {
            return NextResponse.json({ error: 'El archivo está abierto. Ciérrelo y reintente.' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Error al procesar la subida: ' + msg }, { status: 500 });
    }
}
