import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yhpopgxhqtfhghqzswbn.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocG9wZ3hocXRmaGdocXpzd2JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3OTg5NSwiZXhwIjoyMDg3NTU1ODk1fQ.D54RPhIlnfff7U0oxF4JBnvFNGxL50vUDHaXfPoHmQE'

const supabase = createClient(supabaseUrl, serviceKey)

async function checkStats() {
  console.log('📊 ===== ECOFIN MANAGER - STATUS DO BANCO DE DADOS =====\n')
  console.log(`🕐 Consultado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`)

  // ── CLIENTES ──────────────────────────────────────────────
  const { count: totalClientes } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  const { count: clientesAtivos } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: clientesInativos } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'inactive')

  const { count: clientesSuspended } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'suspended')

  console.log('👥 CLIENTES')
  console.log(`   Total:     ${totalClientes}`)
  console.log(`   Ativos:    ${clientesAtivos}`)
  console.log(`   Inativos:  ${clientesInativos}`)
  console.log(`   Suspensos: ${clientesSuspended}`)

  // ── LICENÇAS ──────────────────────────────────────────────
  const { count: totalLicencas } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })

  const { count: licencasAtivas } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: licencasExpiradas } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'expired')

  const { count: licencasPendentes } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Conformidade: licenças ativas / total
  const conformidade = totalLicencas > 0
    ? ((licencasAtivas / totalLicencas) * 100).toFixed(1)
    : '0.0'

  console.log('\n📋 LICENÇAS')
  console.log(`   Total:      ${totalLicencas}`)
  console.log(`   Ativas:     ${licencasAtivas}`)
  console.log(`   Expiradas:  ${licencasExpiradas}`)
  console.log(`   Pendentes:  ${licencasPendentes}`)
  console.log(`   Conformidade: ${conformidade}%`)

  // ── OUTORGAS ──────────────────────────────────────────────
  const { count: totalOutorgas } = await supabase
    .from('outorgas')
    .select('*', { count: 'exact', head: true })

  // Try all status values
  const statusList = ['active', 'valid', 'expired', 'pending', 'inactive', 'suspended']
  const outorgaStats = {}
  for (const s of statusList) {
    const { count } = await supabase
      .from('outorgas')
      .select('*', { count: 'exact', head: true })
      .eq('status', s)
    if (count > 0) outorgaStats[s] = count
  }

  console.log('\n🏛️  OUTORGAS')
  console.log(`   Total: ${totalOutorgas}`)
  for (const [s, c] of Object.entries(outorgaStats)) {
    console.log(`   ${s}: ${c}`)
  }

  // ── PROCESSOS / PIPELINE ──────────────────────────────────
  const { count: totalProcessos } = await supabase
    .from('processes')
    .select('*', { count: 'exact', head: true })

  if (totalProcessos !== null) {
    const stagesQ = await supabase
      .from('processes')
      .select('stage')

    if (stagesQ.data) {
      const stageMap = {}
      for (const row of stagesQ.data) {
        stageMap[row.stage] = (stageMap[row.stage] || 0) + 1
      }
      console.log('\n⚙️  PROCESSOS/PIPELINE')
      console.log(`   Total: ${totalProcessos}`)
      for (const [stage, cnt] of Object.entries(stageMap)) {
        console.log(`   ${stage}: ${cnt}`)
      }
    }
  }

  // ── RESUMO GERAL ──────────────────────────────────────────
  console.log('\n✅ ===== RESUMO =====')
  console.log(`   Clientes:   ${totalClientes}`)
  console.log(`   Licenças:   ${totalLicencas} (${conformidade}% conformidade)`)
  console.log(`   Outorgas:   ${totalOutorgas}`)
  if (totalProcessos !== null) console.log(`   Processos:  ${totalProcessos}`)
  console.log('')
}

checkStats().catch(console.error)
