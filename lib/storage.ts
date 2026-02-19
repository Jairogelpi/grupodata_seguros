import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';
const IS_PRODUCTION = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// Supabase Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yjelnqsbohuorcrpkxng.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZWxucXNib2h1b3JjcnBraG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQxNzAsImV4cCI6MjA4NzA2MDE3MH0.iTHGj5KNWpw9ADMwWRyTI1oSoVaLQxiS-s_FZNgqC78';
const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'metrics';

// In-memory cache to avoid redundant downloads
const storageCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL_MS = 30000; // 30 seconds cache

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

    try {
        console.log(`[Storage] Reading ${filename} from Supabase...`);

        const { data: blob, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filename);

        if (error) {
            console.warn(`[Storage] Supabase error reading ${filename}: ${error.message}.`);
            // Fallback to local disk in development
            if (!IS_PRODUCTION) {
                console.log(`[Storage] Falling back to local disk for ${filename}`);
                return readFromDisk(filename);
            }
            return [];
        }

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        storageCache[filename] = { data, timestamp: Date.now() };
        return data;
    } catch (err) {
        console.error(`[Storage] Error reading ${filename}:`, err);
        if (!IS_PRODUCTION) return readFromDisk(filename);
        return [];
    }
}

/**
 * Write raw file buffer (for uploads).
 * Writes directly to Supabase Storage.
 */
export async function writeData(filename: string, buffer: Buffer): Promise<void> {
    try {
        console.log(`[Storage] Writing ${filename} to Supabase...`);

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, buffer, {
                cacheControl: '0',
                upsert: true
            });

        if (error) {
            throw new Error(`Supabase upload error: ${error.message}`);
        }

        // Invalidate cache
        delete storageCache[filename];

        // Also write to disk in dev for local backup/reference
        if (!IS_PRODUCTION) {
            const filePath = getLocalPath(filename);
            fs.writeFileSync(filePath, buffer);
        }

        console.log(`[Storage] Successfully wrote ${filename} to Supabase`);
    } catch (err) {
        console.error(`[Storage] Error writing ${filename}:`, err);
        throw err;
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
// LOCAL DISK FALLBACK (DEV ONLY)
// ============================================================
function readFromDisk(filename: string): any[] {
    const filePath = getLocalPath(filename);
    if (!fs.existsSync(filePath)) return [];

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
    console.log(`[Storage:Disk] Loaded ${filename} (${data.length} rows)`);
    return data;
}
