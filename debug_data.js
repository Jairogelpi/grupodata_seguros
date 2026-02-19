const { readData } = require('./lib/storage');
const { getRamo } = require('./lib/ramos');

async function debugData() {
    try {
        const polizas = await readData('listado_polizas.xlsx');
        const estados = new Set();
        polizas.forEach(p => estados.add(String(p['Estado'] || 'EMPTY')));
        console.log("Unique Estados:", Array.from(estados));

        const first5 = polizas.slice(0, 5);
        console.log("Sample Rows:", JSON.stringify(first5, null, 2));
    } catch (e) {
        console.error(e);
    }
}

debugData();
