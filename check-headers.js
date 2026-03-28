import * as xlsx from 'xlsx';
import fs from 'fs';

const files = [
    'C:/Users/Administrator/Downloads/sonho/zeradas/Planilha LAR ASV.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/Processsos LO Lic Prefeito.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_ceprof.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_outorgas.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_registro_anm.csv'
];

files.forEach(file => {
    const wb = xlsx.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0];
    console.log(`\n--- ${file} ---`);
    console.log(headers);
});
