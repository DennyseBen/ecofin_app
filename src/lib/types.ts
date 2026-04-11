export interface Licenca {
    id: number
    pasta: number | null
    processo: string
    ano: number | null
    razao_social: string
    cnpj: string | null
    cidade: string | null
    bairro: string | null
    grupo: string | null
    tipo: string
    atividade_licenciada: string | null
    departamento: string | null
    validade: string | null
    validade_serial: number | null
    status: string
    pdf_url: string | null
    data_renovacao: string | null
    data_riaa: string | null
    created_at: string
}

export interface Outorga {
    id: number
    razao_social: string
    cnpj: string | null
    tipo: string
    numero_outorga: string | null
    orgao: string | null
    validade: string | null
    data_renovacao: string | null
    data_riaa: string | null
    pdf_url: string | null
    status: string
    notas: string | null
    created_at: string
}

export interface Cliente {
    id: number
    razao_social: string
    cnpj: string | null
    cidade: string | null
    bairro: string | null
    grupo: string | null
    cep: string | null
    celular: string | null
    email: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    created_at: string
}

export interface Transacao {
    id: number
    descricao: string
    tipo: string
    valor: number
    data: string
    status: string
    cliente_nome: string | null
    created_at: string
}

export interface KanbanCard {
    id: string
    client_name: string
    license_type: string
    responsible: string | null
    stage: string
    protocol_number: string | null
    tax_due_date: string | null
    notes: string | null
    created_at: string
}

export interface DashboardStats {
    total_clientes: number
    total_licencas: number
    licencas_validas: number
    licencas_vencidas: number
    vencendo_90_dias: number
    compliance_rate: number
}

export interface UserProfile {
    id: string
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    role: 'user' | 'admin'
    email_notificacoes: string | null
    whatsapp_notificacoes: string | null
    notify_vencimentos: boolean
    notify_renovacoes: boolean
    notify_sistema: boolean
    gemini_api_key: string | null
}

export interface UserInvite {
    id: number
    invited_by: string
    email: string
    name: string | null
    status: 'pending' | 'accepted'
    created_at: string
}

/**
 * Returns the number of days in advance that the RENOVATION should be started.
 * (Lead p/ renovação)
 */
export function getRenovacaoLeadDays(tipo: string): number {
    const t = (tipo || '').toUpperCase().trim()
    if (['LO', 'LP', 'LI', 'ASV', 'LAR', 'LICENÇA PREFEITO', 'LICENCA PREFEITO', 'LIC. PREFEITO', 'LIC.PREFEITO', 'SUPRESSÃO', 'SUPRESSAO', 'AUV', 'PREFEITO'].some(k => t === k || t.includes(k))) return 120
    if (['ANM', 'CEPROF', 'REGISTRO ANM'].some(k => t === k || t.includes(k))) return 60
    if (t.includes('OUTORGA') || t.includes('DISPENSA')) return 180
    return 90
}

/**
 * Returns the number of days before the renovation deadline that the alert should start firing.
 * (Alerta dispara)
 */
export function getAlertDays(tipo: string): number {
    const t = (tipo || '').toUpperCase().trim()
    // For most types, alert fires 60 days BEFORE the renovation lead date
    // Except Default which doesn't seem to have a specific alert window mentioned beyond the 90 days lead
    if (t === 'ANM' || t.includes('ANM')) return 30
    return 60
}

/**
 * Returns the TOTAL number of days before expiration to consider for the full renewal cycle.
 * (Total antes do vencimento)
 */
export function getTotalDays(tipo: string): number {
    const lead = getRenovacaoLeadDays(tipo)
    const alert = getAlertDays(tipo)
    const t = (tipo || '').toUpperCase().trim()
    if (!['LO', 'LP', 'LI', 'ASV', 'LAR', 'LIC.PREFEITO', 'LICENCA PREFEITO', 'ANM', 'CEPROF', 'OUTORGA', 'SUPRESSAO', 'SUPRESSÃO', 'AUV'].some(k => t.includes(k))) {
        return 90
    }
    return lead + alert
}

/**
 * Returns true when the license is within its type-specific alert window.
 */
export function isInAlertZone(lic: { validade: string | null; tipo: string }): boolean {
    if (!lic.validade) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const valDate = new Date(lic.validade)
    valDate.setHours(0, 0, 0, 0)

    // We care about being within (Lead + Alert) days of the expiration
    const totalThreshold = getTotalDays(lic.tipo)
    const diffDays = Math.floor((valDate.getTime() - today.getTime()) / 86400000)

    return diffDays <= totalThreshold
}

/**
 * Computes the display status of a license based on its validade date.
 */
export function computeStatus(lic: Licenca | Outorga): 'Válida' | 'Vencendo' | 'Vencida' {
    if (!lic.validade) return (lic.status as any) || 'Válida'
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const valDate = new Date(lic.validade)
    valDate.setHours(0, 0, 0, 0)

    if (valDate < today) return 'Vencida'

    const diffDays = Math.floor((valDate.getTime() - today.getTime()) / 86400000)
    const threshold = getTotalDays(lic.tipo)

    if (diffDays <= threshold) return 'Vencendo'
    return 'Válida'
}

export function getDaysRemaining(lic: Licenca | Outorga): number | null {
    if (!lic.validade) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const valDate = new Date(lic.validade)
    valDate.setHours(0, 0, 0, 0)
    return Math.floor((valDate.getTime() - today.getTime()) / 86400000)
}

export function statusBadgeClass(status: string): string {
    switch (status) {
        case 'Válida': return 'badge-green'
        case 'Vencendo': return 'badge-yellow'
        case 'Vencida': return 'badge-red'
        default: return 'badge-yellow'
    }
}

// ─── License types ────────────────────────────────────────────────────────────

export const TIPOS_LICENCA = [
    'LP', 'LI', 'LO',
    'DLA', 'CADRI',
    'RIAA', 'RAL',
    'CEPROF', 'ANM',
    'ASV', 'AUV',
    'Supressão Vegetal',
    'Licença Prefeito',
    'Dispensa de Outorga',
    'Lar',
]

export const TIPOS_OUTORGA = [
    'Captação Superficial',
    'Captação Subterrânea',
    'Lançamento de Efluentes',
    'Barragem',
    'Irrigação',
    'Uso Múltiplo',
]

// ─── Financial Types ──────────────────────────────────────────────────────────

export interface ContratoMensal {
    id: number
    cliente_id: number
    valor: number
    dia_vencimento: number
    descricao: string | null
    ativo: boolean
    created_at: string
}

export type NfseStatus =
    | 'nao_emitida'
    | 'aguardando_processamento'
    | 'autorizado'
    | 'erro'
    | 'cancelado'

export interface FaturaNfe {
    id: number
    cliente_id: number
    competencia: string
    valor_total: number
    status: 'pendente' | 'pago' | 'cancelado'
    data_emissao: string
    data_vencimento: string
    notas: string | null
    created_at: string
    // NFS-e
    nfse_referencia: string | null
    nfse_numero: string | null
    nfse_status: NfseStatus
    nfse_pdf_url: string | null
    nfse_xml_url: string | null
    nfse_erro: string | null
    nfse_emitida_em: string | null
}

export interface ConfigNfse {
    id: number
    cnpj_prestador: string
    inscricao_mun: string
    razao_social: string
    municipio_ibge: string
    uf: string
    codigo_servico: string
    aliquota_iss: number
    discriminacao_padrao: string
    focusnfe_token: string | null
    focusnfe_ambiente: 'homologacao' | 'producao' | null
    updated_at: string
}

export interface ItemFatura {
    id: number
    fatura_id: number
    licenca_id: number | null
    descricao: string
    valor: number
    created_at: string
}
