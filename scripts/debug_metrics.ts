import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';
const POLIZAS_FILE = 'listado_polizas.xlsx';
const LINK_FILE = 'entes_registrados_asesor.xlsx';
const ENTES_FILE = 'entes.xlsx';

const getFilePath = (filename: string) => path.join(DATA_DIR, filename);

const readFile = (filename: string) => {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet);
    } catch (e) {
        console.error("Error reading file", filename, e);
        return [];
    }
};

async function testMetrics() {
    console.log("Reading files...");
    const polizas: any[] = readFile(POLIZAS_FILE);
    const links: any[] = readFile(LINK_FILE);

    // Choose an Asesor that definitely has links
    const sampleLink = links.find(l => l['ASESOR']);
    if (!sampleLink) {
        console.log("No links found.");
        return;
    }
    const comercial = sampleLink['ASESOR'];
    console.log(`Testing Asesor: "${comercial}"`);

    // --- LOGIC FROM metrics/route.ts ---
    // Get all identifiers linked to this Asesor (could be "Name - Code" or just "Code")
    const rawLinkedValues = links
        .filter(l => l['ASESOR'] === comercial)
        .map(l => String(l['ENTE']));

    console.log(`Raw Linked Values (${rawLinkedValues.length}):`, rawLinkedValues.slice(0, 3));

    // Normalize to Codes
    const linkedCodes = rawLinkedValues.map(val => {
        const parts = val.split(' - ');
        return parts.length > 1 ? parts[parts.length - 1].trim() : val.trim();
    });

    console.log(`Normalized Linked Codes (${linkedCodes.length}):`, linkedCodes.slice(0, 3));

    // Filter Polizas
    const filteredPolizas = polizas.filter(p => {
        const enteComercial = String(p['Ente Comercial'] || '');
        // Extract code from Poliza's Ente Comercial (Format: "Name - Code")
        const parts = enteComercial.split(' - ');
        const polizaCode = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();

        // Also check strict code column just in case
        const directCode = String(p['Código'] || '');

        return linkedCodes.includes(polizaCode) || linkedCodes.includes(directCode);
    });
    // -----------------------------------

    console.log(`Filtered Polizas Count: ${filteredPolizas.length}`);

    if (filteredPolizas.length > 0) {
        // Calculate Metrics
        const primasNP = filteredPolizas.reduce((sum, p) => {
            // Handle comma as decimal separator if present (Spanish format)
            let valStr = String(p['P.Produccion']).replace(',', '.');
            const val = parseFloat(valStr);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        console.log(`Total Primas NP: ${primasNP}`);
    } else {
        console.log("WARNING: Still no matches found!");
        // print a sample poliza code extraction to see why
        if (polizas.length > 0) {
            const p = polizas[0];
            const enteComercial = String(p['Ente Comercial'] || '');
            const parts = enteComercial.split(' - ');
            const polizaCode = parts.length > 1 ? parts[parts.length - 1].trim() : enteComercial.trim();
            console.log(`Sample Poliza Extraction: '${enteComercial}' -> '${polizaCode}'`);
        }
    }
}

testMetrics();
