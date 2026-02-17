import { NextResponse } from 'next/server';
import fs from 'fs';
import { getFilePath } from '@/lib/excel';

const TARGET_FILE = 'entes.xlsx';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = getFilePath(TARGET_FILE);

        // Retry logic
        const maxRetries = 3;
        let attempts = 0;
        let saved = false;
        let lastError: any = null;

        while (attempts < maxRetries && !saved) {
            try {
                fs.writeFileSync(filePath, buffer);
                saved = true;
            } catch (error: any) {
                lastError = error;
                attempts++;
                console.error(`Intento ${attempts} fallido al guardar ${TARGET_FILE}:`, error.message);

                // Wait 500ms
                const start = Date.now();
                while (Date.now() - start < 500) { }
            }
        }

        if (!saved) {
            const msg = lastError?.message || '';
            if (lastError?.code === 'EBUSY' || lastError?.code === 'EPERM' || msg.includes('busy') || msg.includes('locked')) {
                return NextResponse.json({ error: `El archivo ${TARGET_FILE} está abierto. Ciérrelo y reintente.` }, { status: 500 });
            }
            throw lastError;
        }

        return NextResponse.json({ success: true, message: 'Archivo actualizado correctamente' });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Error al procesar la subida: ' + error.message }, { status: 500 });
    }
}
