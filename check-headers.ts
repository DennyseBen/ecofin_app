import * as fs from 'fs';
import { read, utils } from 'xlsx';

const files = [
    'C:/Users/Administrator/Downloads/sonho/zeradas/Planilha LAR ASV.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/Processsos LO Lic Prefeito.xlsx'
];

files.forEach(file => {
    const buf = fs.readFileSync(file);
    const wb = read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const headers = utils.sheet_to_json(sheet, { header: 1 })[0];
    console.log(`\n--- ${file} ---`);
    console.log(headers);
});
