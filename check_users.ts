import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf-8')
let SUPABASE_URL = ''
let SUPABASE_SERVICE_KEY = ''
let ADMIN_EMAIL = ''
let ADMIN_PASSWORD = ''

for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim()
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_SERVICE_KEY = line.split('=')[1].trim()
  if (line.startsWith('TEST_ADMIN_EMAIL=')) ADMIN_EMAIL = line.split('=')[1].trim()
  if (line.startsWith('TEST_ADMIN_PASSWORD=')) ADMIN_PASSWORD = line.split('=')[1].trim()
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testAsServiceRole() {
  console.log('\n=== VIEW (service role — bypassa RLS, deve mostrar dados globais) ===')
  const { data, error } = await adminClient.from('vw_dashboard_stats').select('*')
  console.log(JSON.stringify(data, null, 2))
  if (error) console.error('ERRO:', error.message)
}

async function testRpcAsUser(email: string, password: string, label: string) {
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: auth, error: authErr } = await userClient.auth.signInWithPassword({ email, password })
  if (authErr || !auth.session) {
    console.error(`\n[${label}] Login falhou:`, authErr?.message)
    return
  }

  const client = createClient(SUPABASE_URL, auth.session.access_token, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  })

  console.log(`\n=== RPC get_dashboard_stats como [${label}] (${email}) ===`)
  const { data, error } = await client.rpc('get_dashboard_stats')
  console.log(JSON.stringify(data, null, 2))
  if (error) console.error('ERRO:', error.message)

  await userClient.auth.signOut()
}

async function run() {
  await testAsServiceRole()

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await testRpcAsUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'ADMIN')
  } else {
    console.log('\n[INFO] Para testar o RPC com login real, adicione no .env:')
    console.log('  TEST_ADMIN_EMAIL=seu@email.com')
    console.log('  TEST_ADMIN_PASSWORD=suasenha')
  }
}

run()
