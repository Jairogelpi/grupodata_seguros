/**
 * Hybrid Storage Layer
 * - Development: Reads/Writes to local Excel files in DATA_DIR
 * - Production (Vercel): Reads/Writes to Vercel Blob Storage
 * 
 * This ensures that imports and exports persist across serverless restarts.
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { put, list, del } from '@vercel/blob';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';
const IS_PRODUCTION = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// In-memory cache for production reads (avoid re-downloading on every request)
const blobCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TTL_MS = 0; // Disabled: serverless instances don't share memory, so caching causes stale data after uploads

/**
 * Get the local file path for a given filename
 */
function getLocalPath(filename: string): string {
    return path.join(DATA_DIR, filename);
}

/**
 * Read an Excel file and return parsed JSON rows.
 * - Dev: reads from local disk with caching
 * - Prod: reads from Vercel Blob with in-memory cache
 */
export async function readData(filename: string): Promise<any[]> {
    if (!IS_PRODUCTION) {
        return readFromDisk(filename);
    }
    return readFromBlob(filename);
}

/**
 * Write raw file buffer (for uploads).
 * - Dev: writes to local disk
 * - Prod: uploads to Vercel Blob
 */
export async function writeData(filename: string, buffer: Buffer): Promise<void> {
    if (!IS_PRODUCTION) {
        const filePath = getLocalPath(filename);
        fs.writeFileSync(filePath, buffer);
        // Invalidate ALL local cache so every file reloads fresh
        Object.keys(localCache).forEach(key => delete localCache[key]);
        return;
    }
    await writeToBlob(filename, buffer);
}

/**
 * Append a row to an Excel file.
 * - Reads current data, appends row, writes back
 */
export async function appendData(filename: string, newRow: any): Promise<any[]> {
    const currentData = await readData(filename);
    currentData.push(newRow);

    // Rebuild the Excel buffer
    const ws = XLSX.utils.json_to_sheet(currentData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    await writeData(filename, Buffer.from(excelBuffer));
    return currentData;
}

// ============================================================
// LOCAL DISK IMPLEMENTATION
// ============================================================
const localCache: Record<string, { data: any[], mtime: number }> = {};

function readFromDisk(filename: string): any[] {
    const filePath = getLocalPath(filename);
    if (!fs.existsSync(filePath)) return [];

    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    // Return cached if file hasn't changed
    if (localCache[filename] && localCache[filename].mtime === mtime) {
        return localCache[filename].data;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
    localCache[filename] = { data, mtime };
    console.log(`[Storage:Disk] Loaded ${filename} (${data.length} rows)`);
    return data;
}

// ============================================================
// VERCEL BLOB IMPLEMENTATION
// ============================================================
const BLOB_PREFIX = ''; // Files are at root of Blob store

async function readFromBlob(filename: string): Promise<any[]> {
    const blobPath = BLOB_PREFIX + filename;

    // Check in-memory cache first
    const cached = blobCache[filename];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        // List blobs to find our file
        const { blobs } = await list({ prefix: blobPath });
        const blob = blobs.find(b => b.pathname === blobPath);

        if (!blob) {
            console.log(`[Storage:Blob] File ${filename} not found in Blob. Returning empty.`);
            return [];
        }

        // Download the blob content
        const response = await fetch(blob.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        // Update cache
        blobCache[filename] = { data, timestamp: Date.now() };
        console.log(`[Storage:Blob] Loaded ${filename} from Blob (${data.length} rows)`);
        return data;
    } catch (error) {
        console.error(`[Storage:Blob] Error reading ${filename}:`, error);
        return [];
    }
}

async function writeToBlob(filename: string, buffer: Buffer): Promise<void> {
    const blobPath = BLOB_PREFIX + filename;

    try {
        // Upload (overwrite if exists)
        await put(blobPath, buffer, {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
        });

        // Invalidate ALL cache so every file reloads fresh
        Object.keys(blobCache).forEach(key => delete blobCache[key]);
        console.log(`[Storage:Blob] Uploaded ${filename} to Blob — all cache cleared`);
    } catch (error) {
        console.error(`[Storage:Blob] Error writing ${filename}:`, error);
        throw error;
    }
}

/**
 * Sync: Upload all local data files to Blob (one-time setup helper)
 */
export async function syncLocalToBlob(): Promise<string[]> {
    const files = ['listado_polizas.xlsx', 'entes.xlsx', 'entes_registrados_asesor.xlsx', 'lista_asesores.xlsx'];
    const synced: string[] = [];

    for (const file of files) {
        const localPath = getLocalPath(file);
        if (fs.existsSync(localPath)) {
            const buffer = fs.readFileSync(localPath);
            await writeToBlob(file, buffer);
            synced.push(file);
        }
    }

    return synced;
}
