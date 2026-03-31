import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runWipe() {
  console.log("Verificando e fazendo backup das tabelas: clientes, licencas, outorgas...");

  const dataToBackup: any = {};

  const tables = ['clientes', 'licencas', 'outorgas']; // Verifica se 'outorgas' existe ou se eh lincado.
  // Muitas vezes "outorgas" pode ser uma tabela separada.

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        if (error.code === '42P01') {
          console.warn(`Tabela ${table} nao existe. Pulando...`);
          continue;
        }
        throw error;
      }
      dataToBackup[table] = data;
      console.log(`- ${data.length} registros encontrados em: ${table}`);
    } catch (err) {
      console.error(`Erro ao consultar tabela ${table}:`, err);
    }
  }

  const backupPath = 'backup_wipe.json';
  fs.writeFileSync(backupPath, JSON.stringify(dataToBackup, null, 2));
  console.log(`\nBackup de ${Object.keys(dataToBackup).map(t => `${t}: ${dataToBackup[t]?.length}`).join(', ')} salvo em ${backupPath}`);

  console.log("\nApagando os dados permanentes...");

  // Para respeitar chaves estrangeiras, talvez tenhamos que apagar licenças e outorgas antes de clientes
  const delTables = ['outorgas', 'licencas', 'clientes'];

  for (const table of delTables) {
    if (dataToBackup[table]) {
      try {
        if (dataToBackup[table].length > 0) {
          console.log(`Deletando todos os registros da tabela ${table}...`);
          // Deleta todos fazendo where id != null e não vazio? No supabase podemos usar delete().neq('id', 'uuid-ou-zero') ou algo garantido. 
          // O jeito mais pratico e com menos erro eh deletar iterando, mas gasta chamadas API. Usamos .neq()
          // Contudo, in(...) funciona tambem
          const ids = dataToBackup[table].map((r: any) => r.id);
          const chunkSize = 100;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { error: delError } = await supabase.from(table).delete().in('id', chunk);
            if (delError) {
              console.error(`Erro ao deletar chunk em ${table}:`, delError);
            }
          }
        }
        console.log(`- Tabela ${table} limpa.`);
      } catch (err) {
        console.error(`Erro ao deletar em ${table}:`, err);
      }
    }
  }

  console.log("\nOperacao concluida com sucesso. Banco limpo.");
}

runWipe().catch(console.error);
