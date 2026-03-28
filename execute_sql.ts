import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhpopgxhqtfhghqzswbn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function parseInsertToObject(sql: string): { table: string; data: Record<string, any> } | null {
  const match = sql.match(/INSERT INTO public\.(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\);?$/);
  if (!match) return null;

  const table = match[1];
  const columns = match[2].split(',').map(c => c.trim());
  
  // Parse values carefully handling quoted strings with commas
  const valuesStr = match[3];
  const values: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    if (char === "'" && (i === 0 || valuesStr[i - 1] !== "'")) {
      inQuote = !inQuote;
    }
    if (char === ',' && !inQuote) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  const data: Record<string, any> = {};
  columns.forEach((col, i) => {
    const val = values[i]?.trim();
    if (!val || val === 'NULL') {
      data[col] = null;
    } else if (val.startsWith("'") && val.endsWith("'")) {
      data[col] = val.slice(1, -1).replace(/''/g, "'");
    } else if (!isNaN(Number(val))) {
      data[col] = Number(val);
    } else {
      data[col] = val;
    }
  });

  return { table, data };
}

async function run() {
  console.log('📂 Lendo import_seed.sql...');
  const sql = fs.readFileSync('import_seed.sql', 'utf-8');

  const insertLines = sql.split('\n').filter(line => line.trim().startsWith('INSERT'));
  console.log(`📊 Total de ${insertLines.length} registros para importar.\n`);

  let licencasOk = 0, licencasErr = 0;
  let outorgasOk = 0, outorgasErr = 0;
  const errors: string[] = [];

  // Process in batches per table
  const licencasBatch: Record<string, any>[] = [];
  const outorgasBatch: Record<string, any>[] = [];

  for (const line of insertLines) {
    const parsed = parseInsertToObject(line);
    if (!parsed) {
      errors.push(`Parse error: ${line.substring(0, 80)}...`);
      continue;
    }
    if (parsed.table === 'licencas') {
      licencasBatch.push(parsed.data);
    } else if (parsed.table === 'outorgas') {
      outorgasBatch.push(parsed.data);
    }
  }

  console.log(`📋 Licenças a importar: ${licencasBatch.length}`);
  console.log(`📋 Outorgas a importar: ${outorgasBatch.length}\n`);

  // Insert licencas in batches of 50
  const batchSize = 50;
  for (let i = 0; i < licencasBatch.length; i += batchSize) {
    const batch = licencasBatch.slice(i, i + batchSize);
    const { data, error } = await supabase.from('licencas').insert(batch);
    if (error) {
      console.log(`❌ Erro lote licenças ${i}-${i + batch.length}: ${error.message}`);
      // Try one by one
      for (const item of batch) {
        const { error: singleError } = await supabase.from('licencas').insert([item]);
        if (singleError) {
          licencasErr++;
          errors.push(`Licença "${item.razao_social}": ${singleError.message}`);
        } else {
          licencasOk++;
        }
      }
    } else {
      licencasOk += batch.length;
    }
    process.stdout.write(`\r⏳ Licenças: ${licencasOk + licencasErr}/${licencasBatch.length} (✅ ${licencasOk} | ❌ ${licencasErr})`);
  }
  console.log('');

  // Insert outorgas
  if (outorgasBatch.length > 0) {
    const { data, error } = await supabase.from('outorgas').insert(outorgasBatch);
    if (error) {
      console.log(`❌ Erro outorgas: ${error.message}`);
      for (const item of outorgasBatch) {
        const { error: singleError } = await supabase.from('outorgas').insert([item]);
        if (singleError) {
          outorgasErr++;
          errors.push(`Outorga "${item.razao_social}": ${singleError.message}`);
        } else {
          outorgasOk++;
        }
      }
    } else {
      outorgasOk += outorgasBatch.length;
    }
    console.log(`⏳ Outorgas: ✅ ${outorgasOk} | ❌ ${outorgasErr}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTADO FINAL:');
  console.log(`✅ Licenças importadas: ${licencasOk}`);
  console.log(`✅ Outorgas importadas: ${outorgasOk}`);
  console.log(`❌ Erros totais: ${licencasErr + outorgasErr}`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️ Detalhes dos erros (${errors.length}):`);
    errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
    if (errors.length > 20) console.log(`  ... e mais ${errors.length - 20} erros`);
  }
}

run();
