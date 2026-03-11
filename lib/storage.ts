import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { readDatasetFromDb } from './dbData';

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_VERCEL = process.env.VERCEL === '1';
const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yjelnqsbohuorcrpkxng.supabase.co';
const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZWxucXNib2h1b3JjcnBraG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQxNzAsImV4cCI6MjA4NzA2MDE3MH0.iTHGj5KNWpw9ADMwWRyTI1oSoVaLQxiS-s_FZNgqC78';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'metrics';

const readClient = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false
        }
    })
    : null;

const writeClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false
        }
    })
    : null;

const storageCache: Record<string, { data: any[], timestamp: number }> = {};
const pendingReads = new Map<string, Promise<any[]>>();
const CACHE_TTL_MS = 60_000;

function getLocalPath(filename: string): string {
    return path.join(DATA_DIR, filename);
}

function ensureLocalDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

export async function readData(filename: string): Promise<any[]> {
    const cached = storageCache[filename];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const pendingRead = pendingReads.get(filename);
    if (pendingRead) {
        return pendingRead;
    }

    const nextRead = (async () => {
        const refreshed = storageCache[filename];
        if (refreshed && Date.now() - refreshed.timestamp < CACHE_TTL_MS) {
            return refreshed.data;
        }

        const dbData = await readDatasetFromDb(filename);
        if (dbData) {
            storageCache[filename] = { data: dbData, timestamp: Date.now() };
            return dbData;
        }

        if (readClient) {
            try {
                console.log(`[Storage] Reading ${filename} from Supabase...`);
                const { data: blob, error } = await readClient.storage.from(BUCKET_NAME).download(filename);

                if (!error && blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
                    storageCache[filename] = { data, timestamp: Date.now() };
                    return data;
                }

                console.warn(`[Storage] Supabase error/missing reading ${filename}: ${error?.message || 'Empty'}`);
            } catch (err) {
                console.error(`[Storage] Unexpected error reading ${filename}:`, err);
            }
        }

        return readFromDisk(filename);
    })();

    pendingReads.set(filename, nextRead);

    try {
        return await nextRead;
    } finally {
        pendingReads.delete(filename);
    }
}

export async function writeData(filename: string, buffer: Buffer): Promise<void> {
    if (!writeClient) {
        throw new Error(
            `No se puede escribir en el bucket "${BUCKET_NAME}" sin SUPABASE_SERVICE_ROLE_KEY. ` +
            `La lectura puede usar anon key, pero la escritura del servidor no.`
        );
    }

    try {
        console.log(`[Storage] Writing ${filename} to Supabase...`);
        const { error } = await writeClient.storage.from(BUCKET_NAME).upload(filename, buffer, {
            cacheControl: '0',
            upsert: true,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        if (error) {
            console.error(`[Storage] Supabase upload error: ${error.message}`);
            throw new Error(`Failed to save to Supabase: ${error.message}`);
        }

        Object.keys(storageCache).forEach(key => delete storageCache[key]);
        pendingReads.clear();
    } catch (err) {
        console.error(`[Storage] Error writing ${filename} to Supabase:`, err);
        throw err;
    }

    if (!IS_VERCEL) {
        try {
            ensureLocalDataDir();
            const filePath = getLocalPath(filename);
            fs.writeFileSync(filePath, buffer);
            console.log(`[Storage:Disk] Saved ${filename} locally`);
        } catch (err) {
            console.error(`[Storage:Disk] Error writing ${filename}:`, err);
        }
    }
}

export async function appendData(filename: string, newRow: any): Promise<any[]> {
    const currentData = await readData(filename);
    currentData.push(newRow);

    const ws = XLSX.utils.json_to_sheet(currentData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    await writeData(filename, Buffer.from(excelBuffer));
    return currentData;
}

function readFromDisk(filename: string): any[] {
    try {
        const filePath = getLocalPath(filename);
        if (!fs.existsSync(filePath)) return [];
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        console.log(`[Storage:Disk] Loaded ${filename} (${data.length} rows)`);
        return data;
    } catch (err) {
        console.error(`[Storage:Disk] Error reading ${filename}:`, err);
        return [];
    }
}

export async function syncLocalToBlob(): Promise<string[]> {
    const files = [
        'listado_polizas.xlsx', 'entes.xlsx', 'entes_registrados_asesor.xlsx',
        'lista_asesores.xlsx', 'lista_anos.xlsx', 'lista_meses.xlsx', 'lista_estados.xlsx'
    ];
    const synced: string[] = [];

    for (const file of files) {
        try {
            const localPath = getLocalPath(file);
            if (fs.existsSync(localPath)) {
                const buffer = fs.readFileSync(localPath);
                await writeData(file, buffer);
                synced.push(file);
            }
        } catch (e) {
            console.error(`[Storage] Error syncing ${file}:`, e);
        }
    }

    return synced;
}
