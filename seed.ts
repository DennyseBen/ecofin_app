import * as fs from 'fs';
import { read, utils } from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhpopgxhqtfhghqzswbn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzk4OTUsImV4cCI6MjA4NzU1NTg5NX0.B5YmYkoUicQnU9fezCgKu0XkJAc12egJtirXu9pznMM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const files = [
    'C:/Users/Administrator/Downloads/sonho/zeradas/Planilha LAR ASV.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/Processsos LO Lic Prefeito.xlsx',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_ceprof.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_outorgas.csv',
    'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_registro_anm.csv'
];

function parseExcelDate(serial: any) {
    if (!serial) return null;
    if (typeof serial === 'string') {
        const parts = serial.trim().split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toISOString().split('T')[0];
        }
        return null;
    }
    if (typeof serial === 'number') {
        const MathFloor = Math.floor;
        const epoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(epoch.getTime() + (MathFloor(serial) * 86400000)).toISOString().split('T')[0];
    }
    return null;
}

function cleanString(str: any) {
    if (!str) return null;
    return String(str).trim();
}

async function run() {
    console.log("Iniciando importação para o Supabase...");
    let countLicenca = 0;
    let countOutorga = 0;

    for (const file of files) {
        console.log(`\nLendo: ${file}`);
        const buf = fs.readFileSync(file);
        const wb = read(buf, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const data = utils.sheet_to_json<any>(wb.Sheets[sheetName]);

        for (const row of data) {
            const razao_social = cleanString(row['Razão Social'] || row['Razao Social']);
            const cnpj = cleanString(row['CNPJ']);
            if (!razao_social || razao_social === 'Razão Social') continue;

            const tipo = cleanString(row['Tipo']);
            const isOutorga = tipo && tipo.toLowerCase().includes('outorga');
            const orgao = cleanString(row['Depart.'] || row['Depart']);

            const basePayload: any = {
                razao_social,
                cnpj,
                validade: parseExcelDate(row['Validade']),
                data_riaa: parseExcelDate(row['RIAA'] || row['RAL']),
                data_renovacao: parseExcelDate(row['Renovação'] || row['Renovacao']),
                status: cleanString(row['Status']) || 'Válida',
                tipo: tipo || 'Licença',
            };

            if (isOutorga) {
                const outorgaPayload = {
                    ...basePayload,
                    numero_outorga: cleanString(row['Processo']),
                    orgao: orgao
                };
                const res = await supabase.from('outorgas').insert([outorgaPayload]);
                if (res.error) console.log(`  [Erro Outorga] ${razao_social}:`, res.error.message);
                else countOutorga++;
            } else {
                const licencaPayload = {
                    ...basePayload,
                    cidade: cleanString(row['Cidade']),
                    bairro: cleanString(row['Bairro']),
                    pasta: cleanString(row['Pasta']),
                    ano: parseInt(row['Ano']) || undefined,
                    processo: cleanString(row['Processo']),
                    departamento: orgao,
                };
                const res = await supabase.from('licencas').insert([licencaPayload]);
                if (res.error) console.log(`  [Erro Licença] ${razao_social}:`, res.error.message);
                else countLicenca++;
            }
        }
    }
    console.log(`\nImportação concluída!`);
    console.log(`✅ Licenças cadastradas: ${countLicenca}`);
    console.log(`✅ Outorgas cadastradas: ${countOutorga}`);
}

run();
