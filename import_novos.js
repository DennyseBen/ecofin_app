import fs from 'fs';
import * as xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yhpopgxhqtfhghqzswbn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const files = [
    'Planilha de Processos.xlsx'
];

let logContent = '';
function log(msg) {
    console.log(msg);
    logContent += msg + '\n';
    fs.writeFileSync('import_log.txt', logContent, 'utf-8');
}

function parseDate(serial) {
    if (!serial) return null;
    if (typeof serial === 'string') {
        const s = serial.trim();
        const parts = s.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            const d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
        return null;
    }
    if (typeof serial === 'number') {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const dt = new Date(epoch.getTime() + (Math.floor(serial) * 86400000));
        return dt.toISOString().split('T')[0];
    }
    return null;
}

function clean(str) {
    if (str === undefined || str === null || String(str).trim() === '') return null;
    return String(str).trim();
}

async function run() {
    log('🚀 Importando Planilha de Processos.xlsx Node ESM');

    let licOk = 0, licErr = 0;
    let outOk = 0, outErr = 0;
    let cliOk = 0;
    const errorDetails = [];

    const clientesSet = new Set();
    const clientesData = [];

    for (const file of files) {
        if (!fs.existsSync(file)) {
            log(`❌ Arquivo ${file} não encontrado.`);
            continue;
        }

        const buf = fs.readFileSync(file);
        const wb = xlsx.read(buf, { type: 'buffer' });

        for (const sheetName of wb.SheetNames) {
            log(`\n📂 Lendo aba: ${sheetName}`);
            const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
            log(`   ${data.length} linhas encontradas`);

            if (data.length > 0) {
                log("Exemplo: " + JSON.stringify(data[0]));
            }

            const licBatch = [];
            const outBatch = [];

            for (const row of data) {
                const razao_social = clean(row['Razão Social'] || row['Razao Social'] || row['Cliente'] || row['CLIENTE'] || row['Nome']);
                if (!razao_social || razao_social.toUpperCase() === 'RAZÃO SOCIAL') continue;

                const cnpj = clean(row['CNPJ']);
                const tipoRaw = String(row['Tipo'] || row['TIPO'] || '');
                const tipo = clean(row['Tipo'] || row['TIPO']) || 'LO';
                const isOutorga = tipoRaw.toLowerCase().includes('outorga');
                const orgao = clean(row['Depart.'] || row['Depart'] || row['ÓRGÃO'] || row['Orgao'] || row['Órgão']);

                const validade = parseDate(row['Validade'] || row['Vencimento'] || row['VENCIMENTO'] || row['VALIDADE']);
                const riaa_raw = row['RIAA'] || row['RAL'] || row['Data RIAA'];
                const renovacao_raw = row['Renovação'] || row['Renovacao'] || row['RENOVAÇÃO'];
                const statusVal = clean(row['Status'] || row['STATUS']) || 'Válida';
                const data_riaa = parseDate(riaa_raw);
                const data_renovacao = parseDate(renovacao_raw);

                const cidade = clean(row['Cidade']) || clean(row['CIDADE']) || clean(row['Município']);
                const bairro = clean(row['Bairro']) || clean(row['BAIRRO']);

                if (!clientesSet.has(razao_social)) {
                    clientesSet.add(razao_social);
                    clientesData.push({ razao_social, cnpj, cidade, bairro });
                }

                if (isOutorga) {
                    outBatch.push({
                        razao_social,
                        cnpj,
                        tipo,
                        numero_outorga: clean(row['Processo'] || row['PROCESSO'] || row['Nº Processo']),
                        orgao,
                        validade,
                        data_riaa,
                        data_renovacao,
                        status: statusVal,
                    });
                } else {
                    const pasta = parseInt(row['Pasta'] || row['PASTA']);
                    const ano = parseInt(row['Ano'] || row['ANO']);
                    let numProcesso = clean(row['Processo'] || row['PROCESSO']);
                    licBatch.push({
                        razao_social,
                        cnpj,
                        tipo,
                        cidade,
                        bairro,
                        pasta: isNaN(pasta) ? null : pasta,
                        ano: isNaN(ano) ? null : ano,
                        processo: numProcesso,
                        departamento: orgao,
                        validade,
                        data_riaa,
                        riaa_ral: riaa_raw ? String(riaa_raw).trim() : null,
                        data_renovacao,
                        renovacao: renovacao_raw ? String(renovacao_raw).trim() : null,
                        status: statusVal,
                        atividade_licenciada: clean(row['Atividade'] || row['Atividade Licenciada'] || row['ATIVIDADE'])
                    });
                }
            }

            log(`   Preparando inserção de Clientes`);
            for (let i = 0; i < clientesData.length; i += 50) {
                const batch = clientesData.slice(i, i + 50);
                const { error, count } = await supabase.from('clientes').upsert(batch, { onConflict: 'razao_social', ignoreDuplicates: true });
                if (error) { log(`[Cli] Erro: ${error.message}`); } else { cliOk += batch.length; }
            }
            clientesData.length = 0;

            log(`   Preparando inserção: ${licBatch.length} licenças, ${outBatch.length} outorgas...`);

            // Inserir Licencas
            for (let i = 0; i < licBatch.length; i += 50) {
                const batch = licBatch.slice(i, i + 50);
                const { error } = await supabase.from('licencas').insert(batch);
                if (error) {
                    for (const item of batch) {
                        const { error: singleErr } = await supabase.from('licencas').insert([item]);
                        if (singleErr) {
                            delete item.data_riaa;
                            const { error: retryErr } = await supabase.from('licencas').insert([item]);
                            if (retryErr) {
                                licErr++;
                                errorDetails.push(`[Lic] ${item.razao_social}: ${retryErr.message}`);
                            } else { licOk++; }
                        } else { licOk++; }
                    }
                } else { licOk += batch.length; }
            }

            // Inserir Outorgas
            for (let i = 0; i < outBatch.length; i += 50) {
                const batch = outBatch.slice(i, i + 50);
                const { error } = await supabase.from('outorgas').insert(batch);
                if (error) {
                    for (const item of batch) {
                        const { error: singleErr } = await supabase.from('outorgas').insert([item]);
                        if (singleErr) {
                            delete item.data_riaa;
                            const { error: retryErr } = await supabase.from('outorgas').insert([item]);
                            if (retryErr) {
                                outErr++;
                                errorDetails.push(`[Out] ${item.razao_social}: ${retryErr.message}`);
                            } else { outOk++; }
                        } else { outOk++; }
                    }
                } else { outOk += batch.length; }
            }
        }
    }

    log('\n' + '='.repeat(55));
    log('📊 RESULTADO DA IMPORTACÃO V2:');
    log(`   ✅ Clientes processados: ${cliOk}`);
    log(`   ✅ Licenças importadas:  ${licOk}`);
    log(`   ✅ Outorgas importadas:  ${outOk}`);
    log(`   ❌ Erros licenças:       ${licErr}`);
    log(`   ❌ Erros outorgas:       ${outErr}`);

    if (errorDetails.length > 0) {
        log(`\n⚠️  Erros:`);
        errorDetails.slice(0, 30).forEach(e => log(`   - ${e}`));
    }
}

run().catch(e => log(`Fatal: ${e.message}`));
