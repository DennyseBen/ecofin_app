import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const s = createClient(
    'https://yhpopgxhqtfhghqzswbn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE',
    { auth: { persistSession: false } }
);

async function check() {
    const { count: lc } = await s.from('licencas').select('*', { count: 'exact', head: true });
    const { count: oc } = await s.from('outorgas').select('*', { count: 'exact', head: true });

    const result = `Licencas: ${lc}\nOutorgas: ${oc}`;
    fs.writeFileSync('db_status.txt', result, 'utf8');
    console.log(result);
}

check();
