// Backup script - run locally with: node db/backup_data.js
// Requires: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://yhpopgxhqtfhghqzswbn.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SERVICE_ROLE_KEY) {
  console.error('Erro: defina SUPABASE_SERVICE_KEY antes de executar.')
  console.error('Exemplo: SUPABASE_SERVICE_KEY=eyJ... node db/backup_data.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const TABLES = ['clientes', 'outorgas', 'licencas']
const BACKUP_DIR = join(__dirname, 'backup')

async function exportTable(table) {
  console.log(`Exportando ${table}...`)
  let all = []
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw new Error(`Erro em ${table}: ${error.message}`)
    if (!data || data.length === 0) break

    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

async function run() {
  mkdirSync(BACKUP_DIR, { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const summary = {}

  for (const table of TABLES) {
    try {
      const rows = await exportTable(table)
      const file = join(BACKUP_DIR, `${table}_${date}.json`)
      writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8')
      summary[table] = rows.length
      console.log(`  ${table}: ${rows.length} registros -> ${file}`)
    } catch (err) {
      console.error(`  ERRO em ${table}:`, err.message)
    }
  }

  // Salva índice do backup
  const indexFile = join(BACKUP_DIR, `index.json`)
  const existing = []
  try {
    const prev = JSON.parse(require('fs').readFileSync(indexFile, 'utf8'))
    existing.push(...prev)
  } catch {}
  existing.push({ date, tables: summary })
  writeFileSync(indexFile, JSON.stringify(existing, null, 2), 'utf8')

  console.log('\nBackup concluído:', summary)
  console.log(`Arquivos salvos em: ${BACKUP_DIR}`)
  console.log('\nPróximo passo: git add db/backup/ && git commit -m "backup: dados de ' + date + '"')
}

run()
