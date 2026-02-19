const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Try a few possible paths for the data
const possiblePaths = [
    './data/listado_polizas.xlsx',
    'C:/Users/jairo/Desktop/grupodata_seguros/data/listado_polizas.xlsx',
    'C:/Users/jairo.gelpi/Desktop/metricas_carlos/data/listado_polizas.xlsx'
];

async function run() {
    let filePath = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            filePath = p;
            break;
        }
    }

    if (!filePath) {
        console.log("Could not find listado_polizas.xlsx in common paths.");
        return;
    }

    console.log("Reading from:", filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const estados = new Set();
    data.forEach(p => {
        estados.add(p['Estado']);
    });

    console.log("Unique Estados Found:");
    console.log(Array.from(estados));
    console.log("\nSample Row Keys:", Object.keys(data[0] || {}));
    console.log("\nFirst 3 rows sample:");
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
}

run();
