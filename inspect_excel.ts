import * as XLSX from 'xlsx';

try {
    const workbook = XLSX.readFile('Planilha de Processos.xlsx');
    console.log('Planilhas encontradas:', workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
        console.log(`\n--- Primeiras 3 linhas da aba: ${sheetName} ---`);
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
    }
} catch (e) {
    console.error("Erro ao ler o arquivo Excel:", e);
}
