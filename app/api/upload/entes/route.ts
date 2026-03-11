import { NextResponse } from 'next/server';
import { overwriteEntesFromWorkbook } from '@/lib/dbData';
import { invalidateMetricsResponseCache } from '@/lib/metricsResponseCache';
import { invalidateRuntimeDataCache } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se ha subido ningun archivo' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await overwriteEntesFromWorkbook(buffer);
        invalidateRuntimeDataCache('entes.xlsx', 'entes_registrados_asesor.xlsx', 'lista_asesores.xlsx');
        invalidateMetricsResponseCache();

        return NextResponse.json({
            success: true,
            message: 'Entes actualizados correctamente',
            ...result
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Error al procesar la subida: ' + (error?.message || '') }, { status: 500 });
    }
}
