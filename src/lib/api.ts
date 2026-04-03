import { supabase } from './supabase'
import type { Licenca, Outorga, Cliente, Transacao, KanbanCard, DashboardStats, ContratoMensal, FaturaNfe, ItemFatura, ConfigNfse, UserProfile, UserInvite } from './types'
import {
    emitirNfse as focusEmitir,
    consultarNfse as focusConsultar,
    cancelarNfse as focusCancelar,
    gerarReferencia,
    montarPayload,
} from './focusnfe'

/* ══════════════════════════════════════════
   LICENÇAS
   ══════════════════════════════════════════ */

export async function fetchLicencas(): Promise<Licenca[]> {
    const { data, error } = await supabase
        .from('licencas').select('*').order('validade', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function fetchLicencaById(id: number): Promise<Licenca> {
    const { data, error } = await supabase
        .from('licencas').select('*').eq('id', id).single()
    if (error) throw error
    return data
}

export async function fetchLicencasByCliente(razaoSocial: string): Promise<Licenca[]> {
    const { data, error } = await supabase
        .from('licencas').select('*').eq('razao_social', razaoSocial).order('validade')
    if (error) throw error
    return data ?? []
}

export async function fetchLicencasByStatus(status: string): Promise<Licenca[]> {
    const { data, error } = await supabase
        .from('licencas').select('*').eq('status', status).order('validade', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function insertLicenca(lic: Partial<Omit<Licenca, 'id' | 'created_at'>>): Promise<Licenca> {
    // Filter to only valid DB columns
    const validCols = ['razao_social', 'cnpj', 'cidade', 'bairro', 'grupo', 'tipo', 'atividade_licenciada', 'departamento', 'validade', 'status', 'pdf_url', 'data_renovacao', 'pasta', 'processo', 'ano', 'cliente_id', 'riaa_ral', 'renovacao', 'data_riaa'] as const
    const clean: Record<string, any> = {}
    for (const key of validCols) {
        if (key in lic && (lic as any)[key] !== undefined && (lic as any)[key] !== '') {
            clean[key] = (lic as any)[key]
        }
    }
    if (!clean.razao_social) throw new Error('Razão Social é obrigatória')
    if (!clean.tipo) clean.tipo = 'LO'
    if (!clean.status) clean.status = 'Válida'

    const { data, error } = await supabase.from('licencas').insert(clean).select()
    if (error) {
        console.error('insertLicenca error:', error)
        throw error
    }
    return data?.[0] || clean as Licenca
}

export async function updateLicenca(id: number, updates: Partial<Licenca>): Promise<Licenca> {
    const clean: Record<string, any> = {}
    for (const [key, val] of Object.entries(updates)) {
        if (val === '') clean[key] = null
        else if (val !== undefined) clean[key] = val
    }
    const { data, error } = await supabase.from('licencas').update(clean).eq('id', id).select()
    if (error) throw error
    return data?.[0] || clean as Licenca
}

export async function deleteLicenca(id: number): Promise<void> {
    const { error } = await supabase.from('licencas').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   OUTORGAS
   ══════════════════════════════════════════ */

export async function fetchOutorgas(): Promise<Outorga[]> {
    const { data, error } = await supabase
        .from('outorgas').select('*').order('validade', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function insertOutorga(o: Partial<Omit<Outorga, 'id' | 'created_at'>>): Promise<Outorga> {
    const validCols = ['razao_social', 'cnpj', 'tipo', 'numero_outorga', 'orgao', 'validade', 'data_renovacao', 'pdf_url', 'status', 'notas', 'data_riaa'] as const
    const clean: Record<string, any> = {}
    for (const key of validCols) {
        if (key in o && (o as any)[key] !== undefined && (o as any)[key] !== '') {
            clean[key] = (o as any)[key]
        }
    }
    if (!clean.razao_social) throw new Error('Razão Social é obrigatória')
    if (!clean.tipo) clean.tipo = 'Captação Superficial'

    const { data, error } = await supabase.from('outorgas').insert(clean).select()
    if (error) {
        console.error('insertOutorga error:', error)
        throw error
    }
    return data?.[0] || clean as Outorga
}

export async function updateOutorga(id: number, updates: Partial<Outorga>): Promise<Outorga> {
    const clean: Record<string, any> = {}
    for (const [key, val] of Object.entries(updates)) {
        if (val === '') clean[key] = null
        else if (val !== undefined) clean[key] = val
    }
    const { data, error } = await supabase.from('outorgas').update(clean).eq('id', id).select()
    if (error) throw error
    return data?.[0] || clean as Outorga
}

export async function deleteOutorga(id: number): Promise<void> {
    const { error } = await supabase.from('outorgas').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   CLIENTES
   ══════════════════════════════════════════ */

export async function fetchClientes(): Promise<Cliente[]> {
    const { data, error } = await supabase
        .from('clientes').select('*').order('razao_social')
    if (error) throw error
    return data ?? []
}

export async function consultarCNPJ(cnpj: string): Promise<any> {
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (cleanCnpj.length !== 14) throw new Error("CNPJ inválido")

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
    if (!response.ok) {
        throw new Error("Erro ao consultar CNPJ na BrasilAPI")
    }

    const data = await response.json()
    return {
        razao_social: data.razao_social,
        cnpj: data.cnpj,
        cidade: data.municipio,
        bairro: data.bairro,
        cep: data.cep,
        email: data.email,
        celular: data.ddd_telefone_1,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        uf: data.uf
    }
}

export async function fetchClienteById(id: number): Promise<Cliente> {
    const { data, error } = await supabase
        .from('clientes').select('*').eq('id', id).single()
    if (error) throw error
    return data
}

export async function insertCliente(c: Omit<Cliente, 'id' | 'created_at'>): Promise<Cliente> {
    const validCols = ['razao_social', 'cnpj', 'cidade', 'bairro', 'grupo', 'cep', 'celular', 'email', 'logradouro', 'numero', 'complemento'] as const
    const clean: Record<string, any> = {}
    for (const key of validCols) {
        if (key in c && (c as any)[key] !== undefined && (c as any)[key] !== '') {
            clean[key] = (c as any)[key]
        }
    }
    const { data, error } = await supabase.from('clientes').insert(clean).select()
    if (error) throw error
    return data?.[0] || clean as Cliente
}

export async function updateCliente(id: number, updates: Partial<Cliente>): Promise<Cliente> {
    const clean: Record<string, any> = {}
    for (const [key, val] of Object.entries(updates)) {
        if (val === '') clean[key] = null
        else if (val !== undefined) clean[key] = val
    }
    const { data, error } = await supabase.from('clientes').update(clean).eq('id', id).select()
    if (error) throw error
    return data?.[0] || clean as Cliente
}

export async function deleteCliente(id: number): Promise<void> {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   FINANCEIRO
   ══════════════════════════════════════════ */

export async function fetchTransacoes(): Promise<Transacao[]> {
    const { data, error } = await supabase
        .from('financeiro').select('*').order('data', { ascending: false })
    if (error) throw error
    return data ?? []
}

export async function insertTransacao(t: Omit<Transacao, 'id' | 'created_at'>): Promise<Transacao> {
    const { data, error } = await supabase.from('financeiro').insert(t).select().single()
    if (error) throw error
    return data
}

export async function updateTransacao(id: number, updates: Partial<Transacao>): Promise<Transacao> {
    const { data, error } = await supabase.from('financeiro').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function deleteTransacao(id: number): Promise<void> {
    const { error } = await supabase.from('financeiro').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   KANBAN
   ══════════════════════════════════════════ */

export async function fetchKanbanCards(): Promise<KanbanCard[]> {
    const { data, error } = await supabase
        .from('kanban_cards').select('*').order('created_at')
    if (error) throw error
    return data ?? []
}

export async function insertKanbanCard(card: Omit<KanbanCard, 'id' | 'created_at'>): Promise<KanbanCard> {
    const { data, error } = await supabase.from('kanban_cards').insert(card).select().single()
    if (error) throw error
    return data
}

export async function updateKanbanCard(id: string, updates: Partial<KanbanCard>): Promise<KanbanCard> {
    const { data, error } = await supabase.from('kanban_cards').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function deleteKanbanCard(id: string): Promise<void> {
    const { error } = await supabase.from('kanban_cards').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   DASHBOARD STATS
   ══════════════════════════════════════════ */

export async function fetchDashboardStats(): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('get_dashboard_stats')
    if (error) throw error
    return (data as DashboardStats[])[0]
}

/* ── Licenças por Tipo (agrupado) ── */
export async function fetchLicencasPorTipo(): Promise<{ tipo: string; count: number }[]> {
    const { data, error } = await supabase.from('licencas').select('tipo')
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
        counts[row.tipo] = (counts[row.tipo] || 0) + 1
    }
    return Object.entries(counts).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count)
}

/* ── Próximos vencimentos ── */
export async function fetchProximosVencimentos(limit = 8): Promise<Licenca[]> {
    const { data, error } = await supabase
        .from('licencas').select('*')
        .not('validade', 'is', null)
        .order('validade', { ascending: true })
        .limit(limit)
    if (error) throw error
    return data ?? []
}

/* ── Notificações (licenças vencendo em 30 dias) ── */
export async function fetchNotificacoes(): Promise<Licenca[]> {
    const today = new Date().toISOString().split('T')[0]
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const { data, error } = await supabase
        .from('licencas').select('*')
        .not('validade', 'is', null)
        .gte('validade', today)
        .lte('validade', in30)
        .order('validade', { ascending: true })
        .limit(20)
    if (error) throw error
    return data ?? []
}

/* ── Alertas inteligentes (usa threshold por tipo: 60/120/180 dias) ── */
export async function fetchAlertasLicencas(): Promise<Licenca[]> {
    // Busca todas com validade não nula, filtra client-side pelo threshold
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maxFuture = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('licencas').select('*')
        .not('validade', 'is', null)
        .gte('validade', todayStr)
        .lte('validade', maxFuture)
        .order('validade', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function fetchAlertasOutorgas(): Promise<Outorga[]> {
    const todayStr = new Date().toISOString().split('T')[0]
    const maxFuture = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('outorgas').select('*')
        .not('validade', 'is', null)
        .gte('validade', todayStr)
        .lte('validade', maxFuture)
        .order('validade', { ascending: true })
    if (error) throw error
    return data ?? []
}

/** Returns total count of items in alert zone (for sidebar badge) */
export async function fetchAlertCount(): Promise<number> {
    const [licencas, outorgas] = await Promise.all([
        fetchAlertasLicencas(),
        fetchAlertasOutorgas(),
    ])
    const { isInAlertZone } = await import('./types')
    const lCount = licencas.filter(l => isInAlertZone(l)).length
    const oCount = outorgas.filter(o => isInAlertZone(o)).length
    return lCount + oCount
}

/* ══════════════════════════════════════════
   USER PROFILES & ADMIN
   ══════════════════════════════════════════ */

// Admin phone numbers (digits only)
export const ADMIN_PHONES = ['94991037678', '94991324374', '94996639543']

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    if (error) {
        console.error('fetchUserProfile error:', error)
        return null
    }
    // Provide defaults for columns that may not exist yet in the DB
    return {
        id: data.id,
        full_name: data.full_name ?? null,
        avatar_url: data.avatar_url ?? null,
        phone: data.phone ?? null,
        role: data.role ?? 'user',
        email_notificacoes: data.email_notificacoes ?? null,
        whatsapp_notificacoes: data.whatsapp_notificacoes ?? null,
        notify_vencimentos: data.notify_vencimentos ?? true,
        notify_renovacoes: data.notify_renovacoes ?? true,
        notify_sistema: data.notify_sistema ?? true,
        gemini_api_key: data.gemini_api_key ?? null,
    } as UserProfile
}

export async function updateUserProfile(userId: string, updates: Partial<Omit<UserProfile, 'id'>>): Promise<void> {
    // Filter out undefined values to avoid sending nulls for missing fields
    const clean: Record<string, any> = {}
    for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) clean[key] = val
    }
    const { error } = await supabase.from('profiles').update(clean).eq('id', userId)
    if (error) {
        console.error('updateUserProfile error:', error)
        throw error
    }
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
    if (error) throw error
    return (data ?? []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name ?? null,
        avatar_url: d.avatar_url ?? null,
        phone: d.phone ?? null,
        role: d.role ?? 'user',
        email_notificacoes: d.email_notificacoes ?? null,
        whatsapp_notificacoes: d.whatsapp_notificacoes ?? null,
        notify_vencimentos: d.notify_vencimentos ?? true,
        notify_renovacoes: d.notify_renovacoes ?? true,
        notify_sistema: d.notify_sistema ?? true,
        gemini_api_key: d.gemini_api_key ?? null,
    })) as UserProfile[]
}

export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) throw error
}

/* ── Invites ── */
export async function fetchInvites(): Promise<UserInvite[]> {
    const { data, error } = await supabase
        .from('user_invites').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as UserInvite[]
}

export async function inviteUser(email: string, name: string, invitedBy: string): Promise<void> {
    // Save invite record
    const { error: dbErr } = await supabase.from('user_invites').insert({ email, name, invited_by: invitedBy, status: 'pending' })
    if (dbErr) throw dbErr

    // Send magic link (creates user if doesn't exist)
    const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo: window.location.origin,
        }
    })
    if (authErr) throw authErr
}

export async function deleteInvite(id: number): Promise<void> {
    const { error } = await supabase.from('user_invites').delete().eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   FINANÇAS (GERADOR NFE / MENSALIDADES)
   ══════════════════════════════════════════ */

export async function fetchContratos(): Promise<ContratoMensal[]> {
    const { data, error } = await supabase.from('contratos_mensais').select('*, cliente:clientes(*)').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
}

export async function insertContrato(c: Omit<ContratoMensal, 'id' | 'created_at'>): Promise<ContratoMensal> {
    const { data, error } = await supabase.from('contratos_mensais').insert(c).select().single()
    if (error) throw error
    return data
}

export async function updateContrato(id: number, updates: Partial<ContratoMensal>): Promise<ContratoMensal> {
    const { data, error } = await supabase.from('contratos_mensais').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function deleteContrato(id: number): Promise<void> {
    const { error } = await supabase.from('contratos_mensais').delete().eq('id', id)
    if (error) throw error
}

export async function fetchFaturas(competencia?: string): Promise<FaturaNfe[]> {
    let query = supabase.from('faturas_nfe').select('*, cliente:clientes(*)').order('created_at', { ascending: false })
    if (competencia) query = query.eq('competencia', competencia)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
}

export async function fetchItensFatura(fatura_id: number): Promise<ItemFatura[]> {
    const { data, error } = await supabase.from('itens_fatura').select('*').eq('fatura_id', fatura_id).order('created_at')
    if (error) throw error
    return data ?? []
}

export async function gerarFaturasEmLote(competencia: string): Promise<number> {
    const { data: contratos, error: errContratos } = await supabase.from('contratos_mensais').select('*').eq('ativo', true)
    if (errContratos) throw errContratos
    if (!contratos || contratos.length === 0) return 0

    const faturaInserts = contratos.map(c => {
        const ano = parseInt(competencia.split('-')[0])
        const mes = parseInt(competencia.split('-')[1])
        const venc = new Date(ano, mes - 1, c.dia_vencimento)

        return {
            cliente_id: c.cliente_id,
            competencia: competencia,
            valor_total: c.valor,
            status: 'pendente',
            data_vencimento: venc.toISOString().split('T')[0],
            notas: "Fatura gerada automaticamente em lote (Origem: Contrato Mensal)"
        }
    })

    const { data: faturasGeradas, error: errFaturas } = await supabase.from('faturas_nfe').insert(faturaInserts).select()
    if (errFaturas) throw errFaturas
    if (!faturasGeradas) return 0

    const itensInserts = faturasGeradas.map((fat, index) => {
        const c = contratos[index]
        return {
            fatura_id: fat.id,
            licenca_id: null,
            descricao: c.descricao || 'Assessoria Ambiental Mensal',
            valor: c.valor
        }
    })

    const { error: errItens } = await supabase.from('itens_fatura').insert(itensInserts)
    if (errItens) throw errItens

    return faturasGeradas.length
}

export async function updateFaturaStatus(id: number, status: 'pendente' | 'pago' | 'cancelado'): Promise<void> {
    const { error } = await supabase.from('faturas_nfe').update({ status }).eq('id', id)
    if (error) throw error
}

/* ══════════════════════════════════════════
   NFS-e (Focus NF-e Integration)
   ══════════════════════════════════════════ */

export async function fetchConfigNfse(): Promise<ConfigNfse | null> {
    const { data, error } = await supabase.from('config_nfse').select('*').eq('id', 1).single()
    if (error) return null
    return data
}

export async function saveConfigNfse(cfg: Partial<Omit<ConfigNfse, 'id' | 'updated_at'>>): Promise<void> {
    const { error } = await supabase
        .from('config_nfse')
        .upsert({ id: 1, ...cfg, updated_at: new Date().toISOString() })
    if (error) throw error
}

export async function emitirNfseFatura(faturaId: number, discriminacaoOverride?: string): Promise<FaturaNfe> {
    const { data: fatura, error: ef } = await supabase
        .from('faturas_nfe').select('*, cliente:clientes(*)').eq('id', faturaId).single()
    if (ef) throw ef

    const config = await fetchConfigNfse()
    if (!config?.cnpj_prestador) throw new Error('Configure os dados fiscais do prestador em Configurações → NFS-e antes de emitir.')
    if (!config?.focusnfe_token) throw new Error('Token Focus NF-e não configurado. Acesse Configurações → NFS-e e informe o token.')

    const referencia = gerarReferencia(faturaId)
    const cliente = (fatura as any).cliente
    if (!cliente) throw new Error('Cliente não encontrado para esta fatura. Verifique se o cliente está cadastrado e vinculado corretamente.')

    const notasParaUsar = discriminacaoOverride !== undefined ? discriminacaoOverride : (fatura.notas || null)

    const payload = montarPayload(
        { competencia: fatura.competencia, valor_total: fatura.valor_total, notas: notasParaUsar, data_vencimento: fatura.data_vencimento },
        { razao_social: cliente.razao_social, cnpj: cliente.cnpj, logradouro: cliente.logradouro, numero: cliente.numero, cidade: cliente.cidade, bairro: cliente.bairro, cep: cliente.cep, email: cliente.email },
        { cnpj: config.cnpj_prestador, inscricao_mun: config.inscricao_mun, municipio_ibge: config.municipio_ibge, codigo_servico: config.codigo_servico, aliquota_iss: config.aliquota_iss, discriminacao_padrao: config.discriminacao_padrao }
    )

    const nfseConfig = { token: config.focusnfe_token!, ambiente: config.focusnfe_ambiente || 'homologacao' }
    const resposta = await focusEmitir(referencia, payload, nfseConfig)

    const updates: Partial<FaturaNfe> = {
        nfse_referencia: referencia,
        nfse_status: resposta.status as any,
        nfse_numero: resposta.numero || null,
        nfse_pdf_url: resposta.url_pdf || null,
        nfse_xml_url: resposta.url_xml || null,
        nfse_erro: resposta.erros?.[0]?.mensagem || null,
        nfse_emitida_em: new Date().toISOString(),
    }

    const { data: updated, error: eu } = await supabase
        .from('faturas_nfe').update(updates).eq('id', faturaId).select().single()
    if (eu) throw eu
    return updated
}

export async function consultarNfseFatura(faturaId: number): Promise<FaturaNfe> {
    const { data: fatura, error: ef } = await supabase
        .from('faturas_nfe').select('nfse_referencia').eq('id', faturaId).single()
    if (ef) throw ef
    if (!fatura.nfse_referencia) throw new Error('Fatura ainda não foi emitida via NFS-e.')

    const config = await fetchConfigNfse()
    const nfseConfig = config?.focusnfe_token ? { token: config.focusnfe_token, ambiente: config.focusnfe_ambiente || 'homologacao' } : undefined
    const resposta = await focusConsultar(fatura.nfse_referencia, nfseConfig)

    const updates: Partial<FaturaNfe> = {
        nfse_status: resposta.status as any,
        nfse_numero: resposta.numero || null,
        nfse_pdf_url: resposta.url_pdf || null,
        nfse_xml_url: resposta.url_xml || null,
        nfse_erro: resposta.erros?.[0]?.mensagem || null,
    }

    const { data: updated, error: eu } = await supabase
        .from('faturas_nfe').update(updates).eq('id', faturaId).select().single()
    if (eu) throw eu
    return updated
}

export async function cancelarNfseFatura(faturaId: number, justificativa: string): Promise<FaturaNfe> {
    const { data: fatura, error: ef } = await supabase
        .from('faturas_nfe').select('nfse_referencia').eq('id', faturaId).single()
    if (ef) throw ef
    if (!fatura.nfse_referencia) throw new Error('Fatura sem referência NFS-e para cancelar.')

    const config = await fetchConfigNfse()
    const nfseConfig = config?.focusnfe_token ? { token: config.focusnfe_token, ambiente: config.focusnfe_ambiente || 'homologacao' } : undefined
    await focusCancelar(fatura.nfse_referencia, justificativa, nfseConfig)

    const { data: updated, error: eu } = await supabase
        .from('faturas_nfe').update({ nfse_status: 'cancelado' }).eq('id', faturaId).select().single()
    if (eu) throw eu
    return updated
}

export async function emitirLoteNfse(competencia: string): Promise<{ ok: number; erro: number }> {
    const { data: faturas, error } = await supabase
        .from('faturas_nfe')
        .select('id')
        .eq('competencia', competencia)
        .in('nfse_status', ['nao_emitida', 'erro'])
    if (error) throw error
    if (!faturas?.length) throw new Error('Nenhuma fatura pendente de emissão para esta competência.')

    let ok = 0
    let erro = 0
    for (const f of faturas) {
        try {
            await emitirNfseFatura(f.id)
            ok++
        } catch {
            erro++
        }
    }
    return { ok, erro }
}

/* ── Auth ── */
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    })
    if (error) throw error
    return data
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export function onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ?? null)
    })
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}
