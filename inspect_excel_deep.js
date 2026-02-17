const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const filePath = path.join(process.cwd(), '..', 'data', 'listado_polizas.xlsx');
const outputPath = path.join(process.cwd(), 'inspection_results.txt');

// Helper to write to file
function log(message) {
    fs.appendFileSync(outputPath, message + '\n');
    console.log(message);
}

// Clear previous output
fs.writeFileSync(outputPath, '');

log(`Inspecting file: ${filePath}`);

try {
    if (!fs.existsSync(filePath)) {
        log('File not found!');
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    log('Sheet Names: ' + JSON.stringify(sheetNames));

    const firstSheetName = sheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    log(`Total rows in '${firstSheetName}': ${data.length}`);

    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        log('Headers: ' + JSON.stringify(headers));

        // Check unique values in 'Abrev.Cía'
        const companies = new Set();
        const companiesLower = new Set();
        data.forEach(row => {
            if (row['Abrev.Cía']) {
                companies.add(String(row['Abrev.Cía']).trim());
            }
            // Also check for 'Compañía' or similar if it exists
            if (row['Compañía']) {
                companiesLower.add(String(row['Compañía']).trim());
            }
        });

        log("Unique values in 'Abrev.Cía': " + JSON.stringify(Array.from(companies)));
        if (companiesLower.size > 0) {
            log("Unique values in 'Compañía': " + JSON.stringify(Array.from(companiesLower)));
        }

        // Sample first 3 rows
        log('First 3 rows sample: ' + JSON.stringify(data.slice(0, 3), null, 2));
    } else {
        log('Sheet is empty.');
    }

} catch (error) {
    log('Error reading file: ' + error);
}
