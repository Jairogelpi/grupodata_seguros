import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'metrics';

async function selectAllRows(client: any, table: string) {
    const rows: any[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await client.from(table).select('*').range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
    }

    return rows;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const runWriteTest = searchParams.get('mode') === 'write';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const debugInfo: any = {
        env: {
            SUPABASE_URL_EXISTS: !!supabaseUrl,
            SUPABASE_ANON_KEY_EXISTS: !!anonKey,
            SUPABASE_SERVICE_ROLE_KEY_EXISTS: !!serviceRoleKey,
            SUPABASE_URL_HOST: supabaseUrl ? new URL(supabaseUrl).host : null,
            VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
            NODE_ENV: process.env.NODE_ENV
        },
        steps: []
    };

    if (!supabaseUrl || !anonKey) {
        return NextResponse.json({
            error: 'Missing Supabase read configuration',
            debug: debugInfo
        }, { status: 500 });
    }

    try {
        const readClient = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false }
        });

        debugInfo.steps.push('Attempting to list files in bucket with anon key');
        const { data: files, error: listError } = await readClient.storage
            .from(BUCKET_NAME)
            .list();

        if (listError) {
            debugInfo.steps.push('List files FAILED');
            return NextResponse.json({
                error: 'Supabase list error',
                message: listError.message,
                debug: debugInfo
            }, { status: 500 });
        }

        debugInfo.steps.push('List files SUCCESS');
        debugInfo.filesFound = files.map(file => file.name);

        debugInfo.steps.push('Attempting database sanity check with anon key');
        try {
            const [yearsRows, policiesRows, linksRows] = await Promise.all([
                selectAllRows(readClient, 'lista_anos'),
                selectAllRows(readClient, 'listado_polizas'),
                selectAllRows(readClient, 'entes_registrados_asesor')
            ]);

            debugInfo.steps.push('Database sanity check SUCCESS');
            debugInfo.database = {
                listaAnos: yearsRows.map(row => row['AÑO_PROD']).filter(Boolean).sort(),
                listadoPolizasCount: policiesRows.length,
                entesRegistradosCount: linksRows.length
            };
        } catch (dbError: any) {
            debugInfo.steps.push('Database sanity check FAILED');
            debugInfo.databaseError = dbError?.message || String(dbError);
        }

        if (files.length > 0) {
            const firstFile = files[0].name;
            debugInfo.steps.push(`Attempting to download ${firstFile} with anon key`);
            const { data: downloadData, error: downloadError } = await readClient.storage
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

        if (runWriteTest) {
            if (!serviceRoleKey) {
                debugInfo.steps.push('Write test skipped: missing SUPABASE_SERVICE_ROLE_KEY');
                return NextResponse.json({
                    error: 'Missing SUPABASE_SERVICE_ROLE_KEY for write test',
                    debug: debugInfo
                }, { status: 500 });
            }

            const writeClient = createClient(supabaseUrl, serviceRoleKey, {
                auth: { persistSession: false }
            });

            const testPath = `_debug/storage-write-test-${Date.now()}.txt`;
            const testBody = Buffer.from(`write test ${new Date().toISOString()}`);

            debugInfo.steps.push(`Attempting upload to ${testPath} with service role`);
            const { error: uploadError } = await writeClient.storage
                .from(BUCKET_NAME)
                .upload(testPath, testBody, {
                    upsert: true,
                    cacheControl: '0',
                    contentType: 'text/plain'
                });

            if (uploadError) {
                debugInfo.steps.push('Write test upload FAILED');
                return NextResponse.json({
                    error: 'Supabase write test failed',
                    message: uploadError.message,
                    debug: debugInfo
                }, { status: 500 });
            }

            debugInfo.steps.push('Write test upload SUCCESS');

            const { error: removeError } = await writeClient.storage
                .from(BUCKET_NAME)
                .remove([testPath]);

            if (removeError) {
                debugInfo.steps.push('Cleanup FAILED');
                debugInfo.cleanupError = removeError.message;
            } else {
                debugInfo.steps.push('Cleanup SUCCESS');
            }
        }

        return NextResponse.json({
            success: true,
            debug: debugInfo
        });
    } catch (error: any) {
        return NextResponse.json({
            error: 'Unexpected code error',
            message: error.message,
            debug: debugInfo
        }, { status: 500 });
    }
}
