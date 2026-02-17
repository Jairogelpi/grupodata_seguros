import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';

// Global cache for Excel data
const excelCache: Record<string, { data: any[], mtime: number }> = {};

// Watchers set to avoid duplicate watches
const watchers = new Set<string>();

export const getFilePath = (filename: string) => {
    return path.join(DATA_DIR, filename);
};

// Internal function to force read and update cache
const updateCache = (filename: string) => {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) return;
    try {
        const stats = fs.statSync(filePath);
        const mtime = stats.mtimeMs;

        // Skip if already cached and mtime matches
        if (excelCache[filename] && excelCache[filename].mtime === mtime) return;

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        excelCache[filename] = { data, mtime };
        console.log(`[Cache] Updated ${filename} (${data.length} rows)`);

        // Setup background watch if not already watching
        if (!watchers.has(filename)) {
            watchers.add(filename);
            fs.watch(filePath, (event) => {
                if (event === 'change') {
                    // Small delay to let the file lock release
                    setTimeout(() => updateCache(filename), 500);
                }
            });
        }
    } catch (e) {
        console.error(`[Cache] Error pre-loading ${filename}`, e);
    }
};

// Warm up main files
const MAIN_FILES = ['listado_polizas.xlsx', 'entes_registrados_asesor.xlsx', 'entes.xlsx', 'lista_asesores.xlsx'];
MAIN_FILES.forEach(updateCache);

export const readExcel = (filename: string) => {
    // If it's in cache, return it instantly
    const entry = excelCache[filename];
    if (entry) {
        return entry.data;
    }

    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) {
        return [];
    }

    // If not in cache (e.g. a new file), read it and start watching
    updateCache(filename);
    const newEntry = excelCache[filename];
    return newEntry ? newEntry.data : [];
};

export const appendToExcel = (filename: string, newData: any) => {
    const filePath = getFilePath(filename);
    let workbook;
    let worksheet;
    let existingData: any[] = [];

    if (fs.existsSync(filePath)) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[sheetName];
            existingData = XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
            console.error(`Error reading ${filename} for append:`, error);
            throw error;
        }
    } else {
        workbook = XLSX.utils.book_new();
        worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja1');
    }

    existingData.push(newData);
    const newWorksheet = XLSX.utils.json_to_sheet(existingData);
    workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;

    // Write with retry logic
    const maxRetries = 3;
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            // Generate buffer in memory first
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
            // Write to disk using fs
            fs.writeFileSync(filePath, excelBuffer);

            // Update cache after successful write
            const newStats = fs.statSync(filePath);
            excelCache[filename] = { data: existingData, mtime: newStats.mtimeMs };

            return existingData; // Success
        } catch (error: any) {
            attempts++;
            console.error(`Attempt ${attempts} failed to save ${filename}:`, error.message);

            const msg = error.message || '';
            const isLockError = error.code === 'EBUSY' || error.code === 'EPERM' || msg.includes('cannot save file');

            if (isLockError) {
                if (attempts >= maxRetries) {
                    throw new Error(`El archivo ${filename} está bloqueado por el sistema o abierto. Se intentó guardar ${maxRetries} veces sin éxito.`);
                }
                // Wait 500ms before retry
                const start = Date.now();
                while (Date.now() - start < 500) { }
                continue;
            }
            throw error; // Other error, throw immediately
        }
    }
    return existingData;
};
