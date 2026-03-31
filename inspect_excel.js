import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
    const workbook = XLSX.readFile('Planilha de Processos.xlsx');
    const details = {
        sheetNames: workbook.SheetNames,
        samples: {}
    };

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
        details.samples[sheetName] = data.slice(0, 3);
    }

    fs.writeFileSync('excel_structure.json', JSON.stringify(details, null, 2));
    console.log('Criado excel_structure.json');
} catch (e) {
    fs.writeFileSync('excel_structure.json', JSON.stringify({ error: e.message }));
}
