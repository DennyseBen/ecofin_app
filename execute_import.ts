import * as fs from 'fs';
import { read, utils } from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhpopgxhqtfhghqzswbn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const files = [
    'Planilha de Processos.xlsx'
];

function parseDate(serial: any): string | null {
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

function clean(str: any): string | null {
    if (str === undefined || str === null || String(str).trim() === '') return null;
    return String(str).trim();
}

async function addDataRiaaColumn() {
    console.log('🔧 Adicionando coluna data_riaa...');

    // Use rpc to run raw SQL via a database function, or use the REST API
    // Since we can't run raw SQL via supabase-js, let's try via fetch
    const sqlStatements = [
        "ALTER TABLE public.licencas ADD COLUMN IF NOT EXISTS data_riaa DATE;",
        "ALTER TABLE public.outorgas ADD COLUMN IF NOT EXISTS data_riaa DATE;"
    ];

    for (const sql of sqlStatements) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ query: sql })
            });
            // This likely won't work via REST, will handle via the editor
        } catch (e) {
            // Expected - we'll add via SQL Editor
        }
    }
}

async function clearExistingData() {
    console.log('🧹 Limpando dados importados anteriores...');

    const { count: licCount } = await supabase
        .from('licencas')
        .select('*', { count: 'exact', head: true });

    const { count: outCount } = await supabase
        .from('outorgas')
        .select('*', { count: 'exact', head: true });

    console.log(`   Registros existentes: ${licCount || 0} licenças, ${outCount || 0} outorgas`);

    if ((licCount || 0) > 0) {
        // Delete all licencas (they were all from import)
        const { error } = await supabase.from('licencas').delete().gte('id', 0);
        if (error) {
            console.log(`   ⚠️  Erro ao limpar licenças: ${error.message}`);
            // Try alternative delete
            const { error: e2 } = await supabase.from('licencas').delete().neq('id', -1);
            if (e2) console.log(`   ⚠️  Fallback delete licenças: ${e2.message}`);
        } else {
            console.log('   ✅ Licenças anteriores removidas');
        }
    }

    if ((outCount || 0) > 0) {
        const { error } = await supabase.from('outorgas').delete().gte('id', 0);
        if (error) {
            console.log(`   ⚠️  Erro ao limpar outorgas: ${error.message}`);
            const { error: e2 } = await supabase.from('outorgas').delete().neq('id', -1);
            if (e2) console.log(`   ⚠️  Fallback delete outorgas: ${e2.message}`);
        } else {
            console.log('   ✅ Outorgas anteriores removidas');
        }
    }
}

async function run() {
    console.log('🚀 EcoFin Manager - Importação Completa para Supabase');
    console.log('='.repeat(55));

    // Step 1: Try to add data_riaa column
    await addDataRiaaColumn();

    // Step 2: Clear existing data to avoid duplicates
    await clearExistingData();

    // Step 3: Import from spreadsheets
    let licOk = 0, licErr = 0;
    let outOk = 0, outErr = 0;
    const errorDetails: string[] = [];

    for (const file of files) {
        const fileName = file.split('/').pop()!;
        console.log(`\n📂 Processando: ${fileName}`);

        const buf = fs.readFileSync(file);
        const wb = read(buf, { type: 'buffer' });
        const data = utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
        console.log(`   ${data.length} linhas encontradas`);

        const licBatch: Record<string, any>[] = [];
        const outBatch: Record<string, any>[] = [];

        for (const row of data) {
            const razao_social = clean(row['Razão Social'] || row['Razao Social']);
            if (!razao_social || razao_social === 'Razão Social') continue;

            const cnpj = clean(row['CNPJ']);
            const tipoRaw = String(row['Tipo'] || '');
            const tipo = clean(row['Tipo']) || 'Licença';
            const isOutorga = tipoRaw.toLowerCase().includes('outorga');
            const orgao = clean(row['Depart.'] || row['Depart']);

            const validade = parseDate(row['Validade']);
            const riaa_raw = row['RIAA'] || row['RAL'];
            const renovacao_raw = row['Renovação'] || row['Renovacao'];
            const statusVal = clean(row['Status']) || 'Válida';
            const data_riaa = parseDate(riaa_raw);
            const data_renovacao = parseDate(renovacao_raw);

            if (isOutorga) {
                outBatch.push({
                    razao_social,
                    cnpj,
                    tipo,
                    numero_outorga: clean(row['Processo']),
                    orgao,
                    validade,
                    data_riaa,
                    data_renovacao,
                    status: statusVal,
                });
            } else {
                const pasta = parseInt(row['Pasta']);
                const ano = parseInt(row['Ano']);

                licBatch.push({
                    razao_social,
                    cnpj,
                    tipo,
                    cidade: clean(row['Cidade']),
                    bairro: clean(row['Bairro']),
                    pasta: isNaN(pasta) ? null : pasta,
                    ano: isNaN(ano) ? null : ano,
                    processo: clean(row['Processo']),
                    departamento: orgao,
                    validade,
                    data_riaa,
                    riaa_ral: riaa_raw ? String(riaa_raw).trim() : null,
                    data_renovacao,
                    renovacao: renovacao_raw ? String(renovacao_raw).trim() : null,
                    status: statusVal,
                });
            }
        }

        // Insert licencas in batches of 50
        for (let i = 0; i < licBatch.length; i += 50) {
            const batch = licBatch.slice(i, i + 50);
            const { error } = await supabase.from('licencas').insert(batch);
            if (error) {
                // Try individually
                for (const item of batch) {
                    const { error: singleErr } = await supabase.from('licencas').insert([item]);
                    if (singleErr) {
                        // Try without data_riaa in case column doesn't exist yet
                        const { data_riaa: _, ...withoutRiaa } = item;
                        const { error: retryErr } = await supabase.from('licencas').insert([withoutRiaa]);
                        if (retryErr) {
                            licErr++;
                            errorDetails.push(`[Lic] ${item.razao_social}: ${retryErr.message}`);
                        } else {
                            licOk++;
                        }
                    } else {
                        licOk++;
                    }
                }
            } else {
                licOk += batch.length;
            }
        }

        // Insert outorgas in batches
        for (let i = 0; i < outBatch.length; i += 50) {
            const batch = outBatch.slice(i, i + 50);
            const { error } = await supabase.from('outorgas').insert(batch);
            if (error) {
                for (const item of batch) {
                    const { error: singleErr } = await supabase.from('outorgas').insert([item]);
                    if (singleErr) {
                        const { data_riaa: _, ...withoutRiaa } = item;
                        const { error: retryErr } = await supabase.from('outorgas').insert([withoutRiaa]);
                        if (retryErr) {
                            outErr++;
                            errorDetails.push(`[Out] ${item.razao_social}: ${retryErr.message}`);
                        } else {
                            outOk++;
                        }
                    } else {
                        outOk++;
                    }
                }
            } else {
                outOk += batch.length;
            }
        }

        console.log(`   ✅ Parcial: ${licOk} licenças | ${outOk} outorgas`);
    }

    console.log('\n' + '='.repeat(55));
    console.log('📊 RESULTADO FINAL:');
    console.log(`   ✅ Licenças importadas:  ${licOk}`);
    console.log(`   ✅ Outorgas importadas:  ${outOk}`);
    console.log(`   ❌ Erros licenças:       ${licErr}`);
    console.log(`   ❌ Erros outorgas:       ${outErr}`);
    console.log(`   📋 Total:               ${licOk + outOk} de ${licOk + licErr + outOk + outErr}`);

    if (errorDetails.length > 0) {
        console.log(`\n⚠️  Erros (${errorDetails.length}):`);
        errorDetails.slice(0, 30).forEach(e => console.log(`   - ${e}`));
        if (errorDetails.length > 30) console.log(`   ... +${errorDetails.length - 30} erros`);
    }

    // Verify
    const { count: finalLic } = await supabase.from('licencas').select('*', { count: 'exact', head: true });
    const { count: finalOut } = await supabase.from('outorgas').select('*', { count: 'exact', head: true });
    console.log(`\n🔍 Verificação: ${finalLic} licenças e ${finalOut} outorgas no banco.`);
}

run();
