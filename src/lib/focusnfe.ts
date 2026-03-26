/**
 * focusnfe.ts — Integração com a API Focus NF-e
 * Documentação: https://focusnfe.com.br/doc/#nfse
 *
 * Ambiente configurado via variáveis de ambiente:
 *   VITE_FOCUSNFE_TOKEN       — token de acesso (obrigatório)
 *   VITE_FOCUSNFE_AMBIENTE    — "homologacao" | "producao" (default: homologacao)
 */

export type NfseAmbiente = 'homologacao' | 'producao'

export interface NfseConfig {
    token: string
    ambiente: NfseAmbiente
}

export interface NfsePayloadTomador {
    cpf?: string
    cnpj?: string
    razao_social: string
    email?: string
    endereco?: {
        logradouro: string
        numero: string
        complemento?: string
        bairro: string
        codigo_municipio: string
        uf: string
        cep: string
    }
}

export interface NfsePayload {
    data_emissao: string          // ISO date: "2025-03-15"
    prestador: {
        cnpj: string
        inscricao_municipal: string
        codigo_municipio: string  // IBGE: "1504208" para Marabá-PA
    }
    tomador: NfsePayloadTomador
    servico: {
        valor_servicos: number
        valor_deducoes?: number
        valor_pis?: number
        valor_cofins?: number
        valor_inss?: number
        valor_ir?: number
        valor_csll?: number
        iss_retido: '1' | '2'     // 1=retido, 2=não retido
        valor_iss?: number
        aliquota?: number
        codigo_servico: string    // ex: "7.02"
        discriminacao: string
        codigo_municipio: string
    }
}

export interface NfseResposta {
    status: 'autorizado' | 'erro' | 'aguardando_processamento' | 'cancelado'
    numero?: string
    numero_rps?: string
    url_pdf?: string
    url_xml?: string
    mensagem_sefaz?: string
    erros?: { codigo: string; mensagem: string; correcao?: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(ambiente: NfseAmbiente): string {
    return ambiente === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br'
}

function getConfig(override?: Partial<NfseConfig>): NfseConfig {
    const token = override?.token || import.meta.env.VITE_FOCUSNFE_TOKEN
    const ambiente = (override?.ambiente || import.meta.env.VITE_FOCUSNFE_AMBIENTE || 'homologacao') as NfseAmbiente
    if (!token) throw new Error('Token Focus NF-e não configurado. Acesse Configurações → NFS-e e informe o token.')
    return { token, ambiente }
}

function authHeader(token: string): string {
    // Focus NF-e usa Basic Auth com token como usuário e senha em branco
    return 'Basic ' + btoa(token + ':')
}

async function focusRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: object,
    configOverride?: Partial<NfseConfig>
): Promise<T> {
    const { token, ambiente } = getConfig(configOverride)
    const url = getBaseUrl(ambiente) + path

    const resp = await fetch(url, {
        method,
        headers: {
            'Authorization': authHeader(token),
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok && resp.status !== 422) {
        const msg = data?.erros?.[0]?.mensagem || data?.mensagem || `Erro HTTP ${resp.status}`
        throw new Error(msg)
    }

    return data as T
}

// ─── Gera referência única por fatura ─────────────────────────────────────────

export function gerarReferencia(faturaId: number): string {
    const ts = Date.now().toString(36).toUpperCase()
    return `ECOFIN-${faturaId}-${ts}`
}

// ─── Emite uma NFS-e ──────────────────────────────────────────────────────────

export async function emitirNfse(
    referencia: string,
    payload: NfsePayload,
    config?: Partial<NfseConfig>
): Promise<NfseResposta> {
    return focusRequest<NfseResposta>('POST', `/v2/nfse?ref=${referencia}`, payload, config)
}

// ─── Consulta status de uma NFS-e ─────────────────────────────────────────────

export async function consultarNfse(referencia: string, config?: Partial<NfseConfig>): Promise<NfseResposta> {
    return focusRequest<NfseResposta>('GET', `/v2/nfse/${referencia}`, undefined, config)
}

// ─── Cancela uma NFS-e ────────────────────────────────────────────────────────

export async function cancelarNfse(referencia: string, justificativa: string, config?: Partial<NfseConfig>): Promise<NfseResposta> {
    return focusRequest<NfseResposta>('DELETE', `/v2/nfse/${referencia}`, { justificativa }, config)
}

// ─── Monta payload a partir dos dados do app ──────────────────────────────────

export interface DadosFatura {
    competencia: string       // "2025-03"
    valor_total: number
    notas?: string | null
    data_vencimento: string
}

export interface DadosCliente {
    razao_social: string
    cnpj?: string | null
    logradouro?: string | null
    numero?: string | null
    cidade?: string | null
    bairro?: string | null
    cep?: string | null
    email?: string | null
}

export interface DadosPrestador {
    cnpj: string
    inscricao_mun: string
    municipio_ibge: string
    codigo_servico: string
    aliquota_iss: number
    discriminacao_padrao: string
}

export function montarPayload(
    fatura: DadosFatura,
    cliente: DadosCliente,
    prestador: DadosPrestador
): NfsePayload {
    const [ano, mes] = fatura.competencia.split('-')
    const competenciaFmt = `${mes}/${ano}`
    const discriminacao = prestador.discriminacao_padrao.replace('{competencia}', competenciaFmt)

    const tomador: NfsePayloadTomador = {
        razao_social: cliente.razao_social,
        email: cliente.email || undefined,
    }

    if (cliente.cnpj) {
        const cnpjLimpo = cliente.cnpj.replace(/\D/g, '')
        if (cnpjLimpo.length === 14) tomador.cnpj = cnpjLimpo
        else if (cnpjLimpo.length === 11) tomador.cpf = cnpjLimpo
    }

    if (cliente.logradouro || cliente.cidade || cliente.bairro) {
        tomador.endereco = {
            logradouro: cliente.logradouro || cliente.bairro || cliente.cidade || '',
            numero: cliente.numero || 'S/N',
            bairro: cliente.bairro || '',
            codigo_municipio: prestador.municipio_ibge,
            uf: 'PA',
            cep: (cliente.cep || '68500000').replace(/\D/g, ''),
        }
    }

    const aliquota = prestador.aliquota_iss / 100
    const valor_iss = parseFloat((fatura.valor_total * aliquota).toFixed(2))

    return {
        data_emissao: new Date().toISOString().split('T')[0],
        prestador: {
            cnpj: prestador.cnpj.replace(/\D/g, ''),
            inscricao_municipal: prestador.inscricao_mun,
            codigo_municipio: prestador.municipio_ibge,
        },
        tomador,
        servico: {
            valor_servicos: fatura.valor_total,
            valor_deducoes: 0,
            valor_pis: 0,
            valor_cofins: 0,
            valor_inss: 0,
            valor_ir: 0,
            valor_csll: 0,
            iss_retido: '2',
            aliquota: prestador.aliquota_iss,
            valor_iss,
            codigo_servico: prestador.codigo_servico,
            discriminacao: fatura.notas
                ? `${discriminacao}\n${fatura.notas}`
                : discriminacao,
            codigo_municipio: prestador.municipio_ibge,
        },
    }
}

// ─── Verifica se o token está configurado ────────────────────────────────────

export function isNfseConfigurado(dbToken?: string | null): boolean {
    return !!(dbToken || import.meta.env.VITE_FOCUSNFE_TOKEN)
}

export function getAmbiente(dbAmbiente?: string | null): NfseAmbiente {
    return ((dbAmbiente || import.meta.env.VITE_FOCUSNFE_AMBIENTE || 'homologacao') as NfseAmbiente)
}
