const XLSX = require('xlsx');

const file = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data\\listado_polizas.xlsx';
try {
    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const counts = {};
    const productCounts = {};

    let totalRows = 0;

    data.forEach(row => {
        totalRows++;
        const motivo = row['Mot.Anulación'];
        if (motivo) {
            counts[motivo] = (counts[motivo] || 0) + 1;
        }

        // Check product variety per client
        const nif = row['NIF/CIF Tomador'];
        if (nif) {
            if (!productCounts[nif]) productCounts[nif] = new Set();
            productCounts[nif].add(row['Producto']);
        }
    });

    console.log('--- Motivos de Anulación ---');
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n--- Cross Selling Stats ---');
    let oneProduct = 0;
    let multiProduct = 0;
    for (const nif in productCounts) {
        if (productCounts[nif].size > 1) multiProduct++;
        else oneProduct++;
    }
    console.log(`Clientes con 1 producto: ${oneProduct}`);
    console.log(`Clientes muti-producto: ${multiProduct}`);
    const ratio = multiProduct / (oneProduct + multiProduct);
    console.log(`Ratio Multi-producto: ${(ratio * 100).toFixed(2)}%`);

} catch (e) {
    console.error("Error reading file:", e.message);
}
