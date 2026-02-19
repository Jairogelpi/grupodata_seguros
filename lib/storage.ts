import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';
const IS_VERCEL = process.env.VERCEL === '1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yjelnqsbohuorcrpkxng.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZWxucXNib2h1b3JjcnBraG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQxNzAsImV4cCI6MjA4NzA2MDE3MH0.iTHGj5KNWpw9ADMwWRyTI1oSoVaLQxiS-s_FZNgqC78';
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);
const BUCKET_NAME = 'metrics';

const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// In-memory cache to avoid redundant downloads
const storageCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL_MS = 5000; // 5 seconds cache

/**
 * Get the local file path for a given filename
 */
function getLocalPath(filename: string): string {
    return path.join(DATA_DIR, filename);
}

/**
 * Read an Excel file and return parsed JSON rows.
 * Primarily uses Supabase Storage.
 */
export async function readData(filename: string): Promise<any[]> {
    // Check in-memory cache first
    const cached = storageCache[filename];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    if (supabase) {
        try {
            console.log(`[Storage] Reading ${filename} from Supabase...`);
            const { data: blob, error } = await supabase.storage.from(BUCKET_NAME).download(filename);

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

    // Fallback to local
    return readFromDisk(filename);
}

/**
 * Write raw file buffer (for uploads).
 * Writes directly to Supabase Storage.
 */
export async function writeData(filename: string, buffer: Buffer): Promise<void> {
    if (supabase) {
        try {
            console.log(`[Storage] Writing ${filename} to Supabase...`);
            const { error } = await supabase.storage.from(BUCKET_NAME).upload(filename, buffer, {
                cacheControl: '0',
                upsert: true,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            if (error) throw new Error(`Supabase upload error: ${error.message}`);
            // Invalidate ALL entries to ensure consistency across related data
            Object.keys(storageCache).forEach(key => delete storageCache[key]);
        } catch (err) {
            console.error(`[Storage] Error writing ${filename} to Supabase:`, err);
            // If it failed and we are in Vercel, we can't write to disk, so we throw
            if (IS_VERCEL) throw err;
        }
    }

    // Always attempt local write in dev for reference/backup
    if (!IS_VERCEL) {
        try {
            const filePath = getLocalPath(filename);
            fs.writeFileSync(filePath, buffer);
            console.log(`[Storage:Disk] Saved ${filename} locally`);
        } catch (err) {
            console.error(`[Storage:Disk] Error writing ${filename}:`, err);
        }
    }
}

/**
 * Append a row to an Excel file.
 * - Reads current data, appends row, writes back
 */
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

// ============================================================
// LOCAL DISK FALLBACK
// ============================================================
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

/**
 * Sync: Helper to upload all local files to Supabase
 */
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
        } catch (e) { }
    }
    return synced;
}
