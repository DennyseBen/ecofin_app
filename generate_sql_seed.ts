import * as fs from 'fs';
import { read, utils } from 'xlsx';

const files = [
  'C:/Users/Administrator/Downloads/sonho/zeradas/Planilha LAR ASV.xlsx',
  'C:/Users/Administrator/Downloads/sonho/zeradas/Processsos LO Lic Prefeito.xlsx',
  'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_ceprof.csv',
  'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_outorgas.csv',
  'C:/Users/Administrator/Downloads/sonho/zeradas/planilha_registro_anm.csv'
];

function parseExcelDate(serial: any) {
  if (!serial) return 'NULL';
  if (typeof serial === 'string') {
    const parts = serial.trim().split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `'${parts[2]}-${parts[1]}-${parts[0]}'`;
    }
    return 'NULL';
  }
  if (typeof serial === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + (Math.floor(serial) * 86400000));
    return `'${dt.toISOString().split('T')[0]}'`;
  }
  return 'NULL';
}

function cleanString(str: any) {
  if (!str) return 'NULL';
  const san = String(str).trim().replace(/'/g, "''");
  return `'${san}'`;
}

async function run() {
  console.log("Gerando arquivo SQL de importação...");
  let sql = '-- IMPORTAÇÃO DE DADOS (GERADO AUTOMATICAMENTE)\n\n';

  for (const file of files) {
    sql += `-- Arquivo: ${file.split('/').pop()}\n`;
    const buf = fs.readFileSync(file);
    const wb = read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const data = utils.sheet_to_json<any>(wb.Sheets[sheetName]);

    for (const row of data) {
      const razao_social_raw = row['Razão Social'] || row['Razao Social'];
      if (!razao_social_raw || razao_social_raw === 'Razão Social') continue;
      
      const razao_social = cleanString(razao_social_raw);
      const cnpj = cleanString(row['CNPJ']);
      const tipoRaw = String(row['Tipo'] || '');
      const tipo = cleanString(row['Tipo']);
      const isOutorga = tipoRaw.toLowerCase().includes('outorga');
      const orgao = cleanString(row['Depart.'] || row['Depart']);

      const validade = parseExcelDate(row['Validade']);
      const data_riaa = parseExcelDate(row['RIAA'] || row['RAL']);
      const data_renovacao = parseExcelDate(row['Renovação'] || row['Renovacao']);
      const status = cleanString(row['Status'] || 'Válida');

      if (isOutorga) {
        const numero_outorga = cleanString(row['Processo']);
        sql += `INSERT INTO public.outorgas (razao_social, cnpj, validade, data_riaa, data_renovacao, status, tipo, numero_outorga, orgao) VALUES (${razao_social}, ${cnpj}, ${validade}, ${data_riaa}, ${data_renovacao}, ${status}, ${tipo}, ${numero_outorga}, ${orgao});\n`;
      } else {
        const cidade = cleanString(row['Cidade']);
        const bairro = cleanString(row['Bairro']);
        const pasta = cleanString(row['Pasta']);
        const ano = parseInt(row['Ano']) || 'NULL';
        const processo = cleanString(row['Processo']);

        sql += `INSERT INTO public.licencas (razao_social, cnpj, validade, data_riaa, data_renovacao, status, tipo, cidade, bairro, pasta, ano, processo, departamento) VALUES (${razao_social}, ${cnpj}, ${validade}, ${data_riaa}, ${data_renovacao}, ${status}, ${tipo}, ${cidade}, ${bairro}, ${pasta}, ${ano}, ${processo}, ${orgao});\n`;
      }
    }
    sql += `\n`;
  }
  fs.writeFileSync('import_seed.sql', sql);
  console.log(`\nArquivo 'import_seed.sql' gerado com sucesso! Tem ${sql.split('\\n').length} linhas.`);
}

run();
