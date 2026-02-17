import { NextResponse } from 'next/server';
import { syncLocalToBlob } from '@/lib/storage';

/**
 * POST /api/sync
 * One-time utility: Upload all local Excel files to Vercel Blob.
 * Only works in production when BLOB_READ_WRITE_TOKEN is configured.
 */
export async function POST() {
    try {
        const synced = await syncLocalToBlob();
        return NextResponse.json({
            success: true,
            message: `Sincronizados ${synced.length} archivos`,
            files: synced
        });
    } catch (error: any) {
        console.error('[Sync] Error:', error);
        return NextResponse.json({ error: error.message || 'Error al sincronizar' }, { status: 500 });
    }
}
