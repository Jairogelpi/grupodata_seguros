import { NextResponse } from 'next/server';
import { overwritePoliciesFromWorkbook } from '@/lib/dbData';
import { invalidateRuntimeDataCache } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se ha subido ningun archivo' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await overwritePoliciesFromWorkbook(buffer);
        invalidateRuntimeDataCache('listado_polizas.xlsx', 'lista_anos.xlsx', 'lista_meses.xlsx', 'lista_estados.xlsx');

        return NextResponse.json({
            success: true,
            message: 'Polizas actualizadas correctamente',
            ...result
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Error al procesar la subida: ' + (error?.message || '') }, { status: 500 });
    }
}
