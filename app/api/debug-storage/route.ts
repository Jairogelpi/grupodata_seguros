
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const BUCKET_NAME = 'metrics';

    const debugInfo: any = {
        env: {
            SUPABASE_URL_EXISTS: !!SUPABASE_URL,
            SUPABASE_KEY_EXISTS: !!SUPABASE_KEY,
            VERCEL_ENV: process.env.VERCEL || 'not set',
            NODE_ENV: process.env.NODE_ENV
        },
        steps: []
    };

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return NextResponse.json({
            error: 'Missing environment variables in production',
            details: debugInfo
        }, { status: 500 });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Step 1: List files
        debugInfo.steps.push('Attempting to list files in bucket...');
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKET_NAME)
            .list();

        if (listError) {
            debugInfo.steps.push('List files FAILED');
            return NextResponse.json({
                error: 'Supabase List Error',
                message: listError.message,
                details: listError,
                debug: debugInfo
            }, { status: 500 });
        }

        debugInfo.steps.push('List files SUCCESS');
        debugInfo.filesFound = files.map(f => f.name);

        // Step 2: Test Download of a known file
        if (files.length > 0) {
            const firstFile = files[0].name;
            debugInfo.steps.push(`Attempting to download ${firstFile}...`);
            const { data: downloadData, error: downloadError } = await supabase.storage
                .from(BUCKET_NAME)
                .download(firstFile);

            if (downloadError) {
                debugInfo.steps.push(`Download ${firstFile} FAILED`);
                debugInfo.downloadError = downloadError.message;
            } else {
                debugInfo.steps.push(`Download ${firstFile} SUCCESS`);
                debugInfo.fileSize = downloadData.size;
            }
        }

        return NextResponse.json({
            success: true,
            debug: debugInfo
        });

    } catch (e: any) {
        return NextResponse.json({
            error: 'Unexpected code error',
            message: e.message,
            debug: debugInfo
        }, { status: 500 });
    }
}
