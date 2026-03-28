import * as fs from 'fs';
import { read, utils } from 'xlsx';

const files = [
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_outorgas.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_ceprof.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_registro_anm.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/Planilha LAR ASV.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/Processsos LO Lic Prefeito.xlsx',
];

const results: string[] = [];

for (const file of files) {
    const fileName = file.split('/').pop()!;
    results.push(`\n=== ${fileName} ===`);

    const buf = fs.readFileSync(file);
    const wb = read(buf, { type: 'buffer' });
    const data = utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);

    results.push(`Total rows: ${data.length}`);

    // Check headers
    const headers = Object.keys(data[0] || {});
    results.push(`Headers: ${headers.join(', ')}`);

    // Check Tipo column values
    const tipoValues = new Set<string>();
    let outorgaCount = 0;
    let validRows = 0;

    for (const row of data) {
        const razao = row['Razão Social'] || row['Razao Social'];
        if (!razao || razao === 'Razão Social') continue;
        validRows++;

        const tipo = String(row['Tipo'] || '').trim();
        tipoValues.add(tipo || '(empty)');
        if (tipo.toLowerCase().includes('outorga')) outorgaCount++;
    }

    results.push(`Valid rows: ${validRows}`);
    results.push(`Tipo values: ${[...tipoValues].join(' | ')}`);
    results.push(`Rows with "outorga" in Tipo: ${outorgaCount}`);
}

const output = results.join('\n');
fs.writeFileSync('outorga_analysis.txt', output, 'utf8');
console.log(output);
