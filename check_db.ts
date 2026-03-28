import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const s = createClient(
  'https://yhpopgxhqtfhghqzswbn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE',
  { auth: { persistSession: false } }
);

const log: string[] = [];
function l(msg: string) { log.push(msg); console.log(msg); }

async function check() {
  const { count: lc } = await s.from('licencas').select('*', { count: 'exact', head: true });
  const { count: oc } = await s.from('outorgas').select('*', { count: 'exact', head: true });
  l(`Licencas no banco: ${lc}`);
  l(`Outorgas no banco: ${oc}`);

  // Test insert with data_riaa
  const { data, error } = await s.from('licencas').insert([{
    razao_social: 'TESTE APAGAR',
    tipo: 'LO',
    data_riaa: '2025-01-15',
  }]).select();
  
  if (error) {
    l(`Insert ERROR: ${error.message} | code: ${error.code} | details: ${error.details}`);
  } else {
    l(`Insert OK! Has data_riaa: ${'data_riaa' in (data?.[0] || {})}`);
    l(`data_riaa value: ${data?.[0]?.data_riaa}`);
    l(`Columns: ${Object.keys(data?.[0] || {}).join(', ')}`);
    await s.from('licencas').delete().eq('razao_social', 'TESTE APAGAR');
    l('Cleanup done');
  }

  fs.writeFileSync('check_output.txt', log.join('\n'), 'utf8');
}

check();
