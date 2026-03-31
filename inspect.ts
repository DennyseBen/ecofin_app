import { readFile, utils } from 'xlsx';
import * as fs from 'fs';

try {
    console.log("Reading...");
    const wb = readFile('C:/Users/Administrator/Downloads/ecofin-manager/Planilha de Processos.xlsx');
    const details: any = { sheets: wb.SheetNames, data: {} };
    for (const name of wb.SheetNames) {
        const data = utils.sheet_to_json(wb.Sheets[name]);
        details.data[name] = data.slice(0, 3);
    }
    fs.writeFileSync('C:/Users/Administrator/Downloads/ecofin-manager/out.json', JSON.stringify(details, null, 2), 'utf-8');
    console.log("Written.");
} catch (e: any) {
    fs.writeFileSync('C:/Users/Administrator/Downloads/ecofin-manager/out.json', JSON.stringify({ error: e.message, stack: e.stack }), 'utf-8');
    console.log("Error written.");
}
