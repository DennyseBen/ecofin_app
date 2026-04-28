import { useState, useMemo, useCallback } from 'react'
import { Search, Download, FileText, Calendar, Building2, AlertCircle, Printer, MapPin, Droplets, BarChart3, PieChartIcon, TrendingUp, Maximize2, X } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { useRealtime } from '../hooks/useRealtime'
import { fetchAlertasLicencas, fetchAlertasOutorgas, fetchOutorgas, fetchLicencas } from '../lib/api'
import { isInAlertZone, getDaysRemaining, getRenovacaoLeadDays, computeStatus } from '../lib/types'
import type { Licenca, Outorga } from '../lib/types'
import DateRangePicker from '../components/DateRangePicker'
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    AreaChart, Area,
} from 'recharts'

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

function resolveRenovacao(dataRenovacao: string | null, validade: string | null, tipo: string): string | null {
    if (dataRenovacao) return dataRenovacao
    if (!validade) return null
    const leadDays = getRenovacaoLeadDays(tipo)
    const valDate = new Date(validade)
    valDate.setDate(valDate.getDate() - leadDays)
    return valDate.toISOString().split('T')[0]
}

type RegraId = 'curto' | 'padrao' | 'outorgas'

interface Regra {
    id: RegraId
    label: string
    dias: number
    tipos: string[]
    cor: string
}

const REGRAS: Regra[] = [
    {
        id: 'curto', label: 'Curto prazo', dias: 60,
        tipos: ['ANM', 'CEPROF', 'Registro ANM', 'RIAA', 'RAL'],
        cor: 'sky',
    },
    {
        id: 'padrao', label: 'Prazo padrão', dias: 120,
        tipos: ['LO', 'LP', 'LI', 'ASV', 'AUV', 'LAR', 'Supressão', 'CLUA', 'Dispensa de Outorga', 'Licença Prefeito'],
        cor: 'amber',
    },
    {
        id: 'outorgas', label: 'Outorgas hídricas', dias: 180,
        tipos: ['OUTORGA'],
        cor: 'emerald',
    },
]

interface DrillItem {
    id: number
    kind: 'licenca' | 'outorga'
    razao_social: string
    cnpj: string | null
    cidade: string | null
    tipo: string
    validade: string | null
    dias_restantes: number | null
}

interface DrillState {
    title: string
    subtitle: string
    color: string
    items: DrillItem[]
    searchValue?: string
    dateRange?: { from: string; to: string }
}

interface RelatorioItem {
    id: number
    kind: 'licenca' | 'outorga'
    razao_social: string
    cnpj: string | null
    cidade: string | null
    orgao: string | null
    tipo_documento: string
    validade: string | null
    data_renovacao: string | null
    dias_restantes: number | null
    processo: string | null
    numero_outorga: string | null
    regra: RegraId | null
}

function classifyRegra(tipo: string, kind: 'licenca' | 'outorga'): RegraId | null {
    if (kind === 'outorga') return 'outorgas'
    const t = tipo.toUpperCase()
    for (const regra of REGRAS) {
        if (regra.tipos.some(r => t === r.toUpperCase() || t.includes(r.toUpperCase()))) {
            return regra.id
        }
    }
    return 'padrao'
}

// ── Custom Tooltip para recharts ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
            fontSize: 12, fontFamily: 'inherit',
        }}>
            {label && <div style={{ color: 'var(--text-mute)', marginBottom: 6, fontWeight: 600 }}>{label}</div>}
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ color: p.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block' }} />
                    {p.name}: <span style={{ color: 'var(--text-bright)' }}>{p.value}</span>
                </div>
            ))}
        </div>
    )
}

function PieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const p = payload[0]
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
            fontSize: 12, fontFamily: 'inherit',
        }}>
            <div style={{ color: p.payload.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.payload.color, display: 'inline-block' }} />
                {p.name}: <span style={{ color: 'var(--text-bright)' }}>{p.value} ({p.payload.pct}%)</span>
            </div>
        </div>
    )
}

// ── Componente de Card de Gráfico ────────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, children, stat, statLabel, statColor, chartId, expandedId, onToggle }: {
    title: string; subtitle: string; icon: React.ElementType
    children: React.ReactNode
    stat?: string | number; statLabel?: string; statColor?: string
    chartId: string; expandedId: string | null; onToggle: (id: string | null) => void
}) {
    const isExpanded = expandedId === chartId

    const header = (large = false) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div style={{
                        width: large ? 34 : 28, height: large ? 34 : 28, borderRadius: 8,
                        background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon size={large ? 17 : 14} style={{ color: 'var(--primary-fg)' }} />
                    </div>
                    <span style={{ color: 'var(--text-bright)', fontSize: large ? 17 : 14, fontWeight: 700 }}>{title}</span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: large ? 42 : 36 }}>{subtitle}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {stat !== undefined && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: large ? 28 : 22, fontWeight: 800, color: statColor || 'var(--primary-fg)', letterSpacing: -0.5 }}>{stat}</div>
                        {statLabel && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500 }}>{statLabel}</div>}
                    </div>
                )}
                <button
                    onClick={e => { e.stopPropagation(); onToggle(isExpanded ? null : chartId) }}
                    title={isExpanded ? 'Fechar' : 'Expandir'}
                    style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: 'var(--neutral-bg)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-mute)',
                    }}
                >
                    {isExpanded ? <X size={14} /> : <Maximize2 size={14} />}
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* Card normal — sempre visível na grid */}
            <div
                onClick={() => onToggle(chartId)}
                style={{
                    background: 'var(--card-bg)', border: `1px solid ${isExpanded ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 16, padding: '20px 20px 16px',
                    boxShadow: isExpanded ? 'var(--card-shadow), 0 0 0 2px var(--primary-ring)' : 'var(--card-shadow)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s',
                    opacity: isExpanded ? 0.4 : 1,
                }}
            >
                {header(false)}
                {children}
            </div>

            {/* Overlay expandido */}
            {isExpanded && (
                <div
                    onClick={() => onToggle(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.70)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 20, padding: '24px 28px 20px',
                            boxShadow: '0 32px 80px -20px rgba(0,0,0,0.7)',
                            display: 'flex', flexDirection: 'column', gap: 16,
                            width: '92vw', maxWidth: 1100,
                            height: '82vh', maxHeight: 820,
                        }}
                    >
                        {header(true)}
                        <div style={{ flex: 1, minHeight: 0 }}>
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default function Relatorios() {
    const [search, setSearch] = useState('')
    const [activeRegra, setActiveRegra] = useState<RegraId | 'todos'>('todos')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [activeTab, setActiveTab] = useState<'relatorio' | 'graficos'>('relatorio')
    const [expandedChart, setExpandedChart] = useState<string | null>(null)
    const [chartDateFrom, setChartDateFrom] = useState('')
    const [chartDateTo, setChartDateTo] = useState('')
    const [drill, setDrill] = useState<DrillState | null>(null)

    const isDateMode = !!(dateFrom || dateTo)
    const isChartDateMode = !!(chartDateFrom || chartDateTo)

    const { data: licencasAlerta, loading: loadingLic, refetch: refetchLic } = useSupabase(fetchAlertasLicencas, [])
    const { data: outorgasAlerta, loading: loadingOutA, refetch: refetchOutA } = useSupabase(fetchAlertasOutorgas, [])
    const { data: outorgasFull, loading: loadingOutF, refetch: refetchOutF } = useSupabase(fetchOutorgas, [])
    const { data: todasLicencas, loading: loadingAll, refetch: refetchAll2 } = useSupabase(fetchLicencas, [])

    const refetchAll = useCallback(() => { refetchLic(); refetchOutA(); refetchOutF(); refetchAll2() }, [refetchLic, refetchOutA, refetchOutF, refetchAll2])
    useRealtime(['licencas', 'outorgas'], refetchAll)

    const loading = loadingLic || loadingOutA || loadingOutF || loadingAll

    const toRelatorioItem = (lic: Licenca): RelatorioItem => ({
        id: lic.id,
        kind: 'licenca',
        razao_social: lic.razao_social,
        cnpj: lic.cnpj,
        cidade: lic.cidade ?? null,
        orgao: lic.departamento ?? null,
        tipo_documento: lic.tipo,
        validade: lic.validade,
        data_renovacao: resolveRenovacao(lic.data_renovacao, lic.validade, lic.tipo),
        dias_restantes: getDaysRemaining(lic),
        processo: lic.processo ?? null,
        numero_outorga: null,
        regra: classifyRegra(lic.tipo, 'licenca'),
    })

    const toRelatorioItemOut = (out: Outorga): RelatorioItem => ({
        id: out.id,
        kind: 'outorga',
        razao_social: out.razao_social,
        cnpj: out.cnpj,
        cidade: null,
        orgao: out.orgao ?? null,
        tipo_documento: out.tipo,
        validade: out.validade,
        data_renovacao: resolveRenovacao(out.data_renovacao, out.validade, out.tipo),
        dias_restantes: getDaysRemaining(out),
        processo: null,
        numero_outorga: out.numero_outorga ?? null,
        regra: 'outorgas',
    })

    const allItems = useMemo((): RelatorioItem[] => {
        const result: RelatorioItem[] = []
        if (isDateMode) {
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
            const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
            for (const lic of todasLicencas) {
                if (!lic.validade) continue
                const val = new Date(lic.validade.split('T')[0] + 'T00:00:00')
                if (from && val < from) continue
                if (to && val > to) continue
                result.push(toRelatorioItem(lic))
            }
            for (const out of outorgasFull) {
                if (!out.validade) continue
                const val = new Date(out.validade.split('T')[0] + 'T00:00:00')
                if (from && val < from) continue
                if (to && val > to) continue
                result.push(toRelatorioItemOut(out))
            }
        } else {
            for (const lic of licencasAlerta) {
                if (!isInAlertZone(lic)) continue
                result.push(toRelatorioItem(lic))
            }
            for (const out of outorgasFull) {
                if (!isInAlertZone(out)) continue
                result.push(toRelatorioItemOut(out))
            }
        }
        return result.sort((a, b) => {
            if (!a.validade && !b.validade) return 0
            if (!a.validade) return 1
            if (!b.validade) return -1
            return a.validade.localeCompare(b.validade)
        })
    }, [licencasAlerta, outorgasFull, todasLicencas, isDateMode, dateFrom, dateTo])

    const regraCounts = useMemo(() => {
        const counts: Record<RegraId, number> = { curto: 0, padrao: 0, outorgas: 0 }
        for (const item of allItems) {
            if (item.regra) counts[item.regra]++
        }
        return counts
    }, [allItems])

    const regraFiltered = useMemo((): RelatorioItem[] => {
        if (isDateMode) return allItems
        if (activeRegra === 'todos') return allItems
        return allItems.filter(i => i.regra === activeRegra)
    }, [allItems, activeRegra, isDateMode])

    const filtered = useMemo(() => {
        if (!search) return regraFiltered
        const s = search.toLowerCase()
        const sCnpj = s.replace(/\D/g, '')
        return regraFiltered.filter(item =>
            item.razao_social.toLowerCase().includes(s) ||
            (item.cnpj && item.cnpj.toLowerCase().includes(s)) ||
            (sCnpj.length > 0 && (item.cnpj || '').replace(/\D/g, '').includes(sCnpj)) ||
            (item.cidade && item.cidade.toLowerCase().includes(s)) ||
            (item.orgao && item.orgao.toLowerCase().includes(s))
        )
    }, [regraFiltered, search])

    // ── Dados para gráficos — com filtro de período independente ────────────
    const chartFilteredLicencas = useMemo(() => {
        if (!isChartDateMode) return todasLicencas
        const from = chartDateFrom ? chartDateFrom : null
        const to = chartDateTo ? chartDateTo : null
        return todasLicencas.filter(lic => {
            if (!lic.validade) return false
            const val = lic.validade.split('T')[0]
            if (from && val < from) return false
            if (to && val > to) return false
            return true
        })
    }, [todasLicencas, isChartDateMode, chartDateFrom, chartDateTo])

    const chartFilteredOutorgas = useMemo(() => {
        if (!isChartDateMode) return outorgasFull
        const from = chartDateFrom ? chartDateFrom : null
        const to = chartDateTo ? chartDateTo : null
        return outorgasFull.filter(out => {
            if (!out.validade) return false
            const val = out.validade.split('T')[0]
            if (from && val < from) return false
            if (to && val > to) return false
            return true
        })
    }, [outorgasFull, isChartDateMode, chartDateFrom, chartDateTo])

    const chartStatus = useMemo(() => {
        let validas = 0, vencendo = 0, vencidas = 0
        for (const lic of chartFilteredLicencas) {
            const s = computeStatus(lic)
            if (s === 'Válida') validas++
            else if (s === 'Vencendo') vencendo++
            else vencidas++
        }
        for (const out of chartFilteredOutorgas) {
            const s = computeStatus(out)
            if (s === 'Válida') validas++
            else if (s === 'Vencendo') vencendo++
            else vencidas++
        }
        const total = validas + vencendo + vencidas || 1
        return [
            { name: 'Válidas', value: validas, color: '#10b981', pct: Math.round(validas / total * 100) },
            { name: 'Vencendo', value: vencendo, color: '#f59e0b', pct: Math.round(vencendo / total * 100) },
            { name: 'Vencidas', value: vencidas, color: '#f43f5e', pct: Math.round(vencidas / total * 100) },
        ]
    }, [chartFilteredLicencas, chartFilteredOutorgas])

    const chartVencimentos = useMemo(() => {
        const months: Record<string, { licencas: number; outorgas: number }> = {}
        // Com filtro: exibe os meses do período selecionado
        // Sem filtro: exibe os próximos 12 meses a partir de hoje
        if (isChartDateMode && (chartDateFrom || chartDateTo)) {
            const start = chartDateFrom
                ? new Date(chartDateFrom + 'T12:00:00')
                : new Date()
            const end = chartDateTo
                ? new Date(chartDateTo + 'T12:00:00')
                : new Date(start.getFullYear(), start.getMonth() + 12, 1)
            let cur = new Date(start.getFullYear(), start.getMonth(), 1)
            const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
            while (cur <= endMonth) {
                const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
                months[key] = { licencas: 0, outorgas: 0 }
                cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
            }
        } else {
            const now = new Date()
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                months[key] = { licencas: 0, outorgas: 0 }
            }
        }
        for (const lic of chartFilteredLicencas) {
            if (!lic.validade) continue
            const key = lic.validade.split('T')[0].slice(0, 7)
            if (months[key] !== undefined) months[key].licencas++
        }
        for (const out of chartFilteredOutorgas) {
            if (!out.validade) continue
            const key = out.validade.split('T')[0].slice(0, 7)
            if (months[key] !== undefined) months[key].outorgas++
        }
        return Object.entries(months).map(([key, v]) => ({
            mes: new Date(key + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            _key: key,
            Licenças: v.licencas,
            Outorgas: v.outorgas,
        }))
    }, [chartFilteredLicencas, chartFilteredOutorgas, isChartDateMode, chartDateFrom, chartDateTo])

    const chartTipos = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const lic of chartFilteredLicencas) {
            const k = lic.tipo || 'Outros'
            counts[k] = (counts[k] || 0) + 1
        }
        for (const out of chartFilteredOutorgas) {
            const k = out.tipo || 'Outorga'
            counts[k] = (counts[k] || 0) + 1
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tipo, total]) => ({ tipo, total }))
    }, [chartFilteredLicencas, chartFilteredOutorgas])

    const chartCidades = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const lic of chartFilteredLicencas) {
            if (lic.cidade) counts[lic.cidade] = (counts[lic.cidade] || 0) + 1
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([cidade, total]) => ({ cidade, total }))
    }, [chartFilteredLicencas])

    // ── Drill-down helpers ───────────────────────────────────────────────────
    const toDrillItem = (l: Licenca): DrillItem => ({
        id: l.id, kind: 'licenca', razao_social: l.razao_social,
        cnpj: l.cnpj, cidade: l.cidade ?? null, tipo: l.tipo,
        validade: l.validade, dias_restantes: getDaysRemaining(l),
    })
    const toDrillItemOut = (o: Outorga): DrillItem => ({
        id: o.id, kind: 'outorga', razao_social: o.razao_social,
        cnpj: o.cnpj, cidade: null, tipo: o.tipo,
        validade: o.validade, dias_restantes: getDaysRemaining(o),
    })
    const sortByValidade = (a: DrillItem, b: DrillItem) =>
        (a.validade || '').localeCompare(b.validade || '')

    const handleDrillStatus = useCallback((statusName: string) => {
        const normalStatus = statusName === 'Válidas' ? 'Válida' : statusName === 'Vencendo' ? 'Vencendo' : 'Vencida'
        const colorMap: Record<string, string> = { 'Válidas': '#10b981', 'Vencendo': '#f59e0b', 'Vencidas': '#f43f5e' }
        const items = [
            ...chartFilteredLicencas.filter(l => computeStatus(l) === normalStatus).map(toDrillItem),
            ...chartFilteredOutorgas.filter(o => computeStatus(o) === normalStatus).map(toDrillItemOut),
        ].sort(sortByValidade)
        setDrill({ title: statusName, subtitle: 'filtrado por status', color: colorMap[statusName] || '#10b981', items })
    }, [chartFilteredLicencas, chartFilteredOutorgas])

    const handleDrillTipo = useCallback((tipo: string) => {
        const items = [
            ...chartFilteredLicencas.filter(l => l.tipo === tipo).map(toDrillItem),
            ...chartFilteredOutorgas.filter(o => o.tipo === tipo).map(toDrillItemOut),
        ].sort(sortByValidade)
        setDrill({ title: tipo, subtitle: 'filtrado por tipo de documento', color: '#10b981', items, searchValue: tipo })
    }, [chartFilteredLicencas, chartFilteredOutorgas])

    const handleDrillCidade = useCallback((cidade: string) => {
        const items = chartFilteredLicencas.filter(l => l.cidade === cidade).map(toDrillItem).sort(sortByValidade)
        setDrill({ title: cidade, subtitle: 'filtrado por município', color: '#38bdf8', items, searchValue: cidade })
    }, [chartFilteredLicencas])

    const handleDrillMes = useCallback((key: string, label: string) => {
        const [year, month] = key.split('-').map(Number)
        const from = `${key}-01`
        const to = `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
        const items = [
            ...chartFilteredLicencas.filter(l => {
                if (!l.validade) return false
                const v = l.validade.split('T')[0]
                return v >= from && v <= to
            }).map(toDrillItem),
            ...chartFilteredOutorgas.filter(o => {
                if (!o.validade) return false
                const v = o.validade.split('T')[0]
                return v >= from && v <= to
            }).map(toDrillItemOut),
        ].sort(sortByValidade)
        setDrill({ title: label, subtitle: 'vencimentos neste mês', color: '#10b981', items, dateRange: { from, to } })
    }, [chartFilteredLicencas, chartFilteredOutorgas])

    const totalCarteira = chartFilteredLicencas.length + chartFilteredOutorgas.length
    const complianceRate = totalCarteira > 0
        ? Math.round(chartStatus[0].value / totalCarteira * 100)
        : 0

    // ── PDF ────────────────────────────────────────────────────────────────
    const generatePDF = async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ])
        const doc = new jsPDF('landscape')
        const pageW = doc.internal.pageSize.getWidth()
        const pageH = doc.internal.pageSize.getHeight()
        const fmtDatePdf = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
        const regraLabel = isDateMode
            ? `Período: ${dateFrom ? fmtDatePdf(dateFrom) : '—'} a ${dateTo ? fmtDatePdf(dateTo) : '—'}`
            : activeRegra === 'todos' ? 'Todos os alertas' : REGRAS.find(r => r.id === activeRegra)?.label ?? activeRegra

        doc.setFillColor(16, 185, 129)
        doc.rect(0, 0, pageW, 42, 'F')
        doc.setFillColor(13, 148, 103)
        doc.rect(0, 38, pageW, 4, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.text('EcoFin Manager', 15, 16)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Relatório de Renovações — ${regraLabel}`, 15, 26)
        doc.setFontSize(9)
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 34)
        const totalText = `${filtered.length} alerta${filtered.length !== 1 ? 's' : ''}`
        const tw = doc.getTextWidth(totalText) + 12
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(pageW - tw - 15, 28, tw, 10, 2, 2, 'F')
        doc.setTextColor(16, 185, 129)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(totalText, pageW - tw - 15 + 6, 34.5)

        const summaryY = 52
        doc.setTextColor(60, 60, 60)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Resumo por Regra de Antecedência', 15, summaryY)
        const boxW = 82, boxH = 18, boxGap = 8, boxStartX = 15, boxY = summaryY + 4
        REGRAS.forEach((regra, idx) => {
            const x = boxStartX + idx * (boxW + boxGap)
            const isSelected = activeRegra === regra.id || activeRegra === 'todos'
            if (isSelected) { doc.setFillColor(16, 185, 129); doc.setTextColor(255, 255, 255) }
            else { doc.setFillColor(245, 245, 245); doc.setTextColor(80, 80, 80) }
            doc.roundedRect(x, boxY, boxW, boxH, 3, 3, 'F')
            doc.setFontSize(10); doc.setFont('helvetica', 'bold')
            doc.text(`${regra.dias}d · ${regra.label}`, x + 4, boxY + 7)
            doc.setFontSize(8); doc.setFont('helvetica', 'normal')
            doc.text(`${regraCounts[regra.id]} alerta${regraCounts[regra.id] !== 1 ? 's' : ''}`, x + 4, boxY + 13)
        })

        const tableData = filtered.map(item => [
            item.kind === 'licenca' ? 'Licença' : 'Outorga',
            item.razao_social, item.cnpj || '—', item.cidade || '—',
            item.tipo_documento, item.orgao || '—',
            item.processo || item.numero_outorga || '—',
            formatDate(item.data_renovacao), formatDate(item.validade),
            item.dias_restantes !== null ? `${item.dias_restantes}d` : '—'
        ])
        autoTable(doc, {
            head: [['Tipo', 'Razão Social', 'CNPJ', 'Cidade', 'Documento', 'Órgão', 'Processo/Nº', 'Renovação', 'Vencimento', 'Dias']],
            body: tableData, startY: boxY + boxH + 10,
            styles: { fontSize: 7, cellPadding: 2, lineColor: [230, 230, 230], lineWidth: 0.2 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: {
                0: { cellWidth: 18 }, 1: { cellWidth: 46 }, 2: { cellWidth: 28 },
                3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 },
                6: { cellWidth: 24 }, 7: { cellWidth: 20 }, 8: { cellWidth: 20 },
                9: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 9) {
                    const dias = parseInt(data.cell.raw as string)
                    if (isNaN(dias)) return
                    if (dias <= 15) data.cell.styles.textColor = [220, 38, 38]
                    else if (dias <= 45) data.cell.styles.textColor = [217, 119, 6]
                    else data.cell.styles.textColor = [22, 163, 74]
                }
            },
        })

        const totalPages = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i)
            doc.setFillColor(245, 245, 245)
            doc.rect(0, pageH - 12, pageW, 12, 'F')
            doc.setFontSize(7.5); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal')
            doc.text('EcoFin Manager — Relatório de Renovações', 15, pageH - 5)
            doc.text(`Página ${i} de ${totalPages}`, pageW - 40, pageH - 5)
        }
        const suffix = isDateMode
            ? `periodo_${dateFrom || 'inicio'}_${dateTo || 'fim'}`
            : activeRegra === 'todos' ? 'todos' : activeRegra
        doc.save(`relatorio_renovacoes_${suffix}_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    const regraCorMap: Record<string, { active: string; inactive: string; count: string }> = {
        sky: {
            active: 'bg-sky-500 text-white shadow-lg shadow-sky-500/30',
            inactive: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-500/20',
            count: 'text-sky-200',
        },
        amber: {
            active: 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
            inactive: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-500/20',
            count: 'text-amber-200',
        },
        emerald: {
            active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
            inactive: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
            count: 'text-emerald-200',
        },
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <FileText className="text-emerald-500" size={32} />
                        Relatórios
                    </h1>
                    <p style={{ color: 'var(--text-mute)', fontSize: 13, marginTop: 4 }}>
                        Acompanhamento de licenças e outorgas por regra de antecedência
                    </p>
                </div>

                {/* Tab switcher */}
                <div style={{
                    display: 'flex', gap: 4, padding: 4,
                    background: 'var(--input-bg)', border: '1px solid var(--border)',
                    borderRadius: 12,
                }}>
                    <button
                        onClick={() => setActiveTab('relatorio')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                            background: activeTab === 'relatorio' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'relatorio' ? 'var(--primary-ink)' : 'var(--text-mute)',
                            transition: 'all .15s',
                        }}
                    >
                        <FileText size={14} />
                        Relatório
                    </button>
                    <button
                        onClick={() => setActiveTab('graficos')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                            background: activeTab === 'graficos' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'graficos' ? 'var(--primary-ink)' : 'var(--text-mute)',
                            transition: 'all .15s',
                        }}
                    >
                        <BarChart3 size={14} />
                        Gráficos
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                ABA RELATÓRIO
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'relatorio' && (
                <>
                    {/* Filtros */}
                    <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl p-6 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                    Buscar (Razão Social, CNPJ, Cidade ou Órgão)
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Digite razão social, CNPJ, cidade..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                    Filtrar por período de vencimento
                                </label>
                                <DateRangePicker
                                    dateFrom={dateFrom}
                                    dateTo={dateTo}
                                    onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
                                />
                                {isDateMode && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold">
                                        Mostrando todas as licenças e outorgas que vencem neste período
                                    </p>
                                )}
                            </div>
                        </div>

                        {!isDateMode && (
                            <div className="mt-4">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                    Filtrar por regra de antecedência
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    <button
                                        onClick={() => setActiveRegra('todos')}
                                        className={`px-3 py-3 rounded-2xl text-sm font-bold transition-all ${activeRegra === 'todos'
                                            ? 'bg-slate-700 text-white shadow-lg shadow-slate-700/30'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                    >
                                        <div>Todos</div>
                                        <div className={`text-[10px] mt-1 font-semibold ${activeRegra === 'todos' ? 'text-slate-300' : 'text-slate-400'}`}>
                                            {allItems.length} alertas
                                        </div>
                                    </button>
                                    {REGRAS.map(regra => {
                                        const isActive = activeRegra === regra.id
                                        const cores = regraCorMap[regra.cor]
                                        return (
                                            <button
                                                key={regra.id}
                                                onClick={() => setActiveRegra(isActive ? 'todos' : regra.id)}
                                                className={`px-3 py-3 rounded-2xl text-sm font-bold transition-all ${isActive ? cores.active : cores.inactive}`}
                                            >
                                                <div>{regra.dias}d</div>
                                                <div className="text-[10px] opacity-80">{regra.label}</div>
                                                <div className={`text-[10px] mt-1 font-semibold ${isActive ? cores.count : 'text-slate-400 dark:text-slate-500'}`}>
                                                    {regraCounts[regra.id]} {regraCounts[regra.id] === 1 ? 'alerta' : 'alertas'}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                            <div className="flex items-center gap-2 text-sm">
                                <AlertCircle size={16} className="text-amber-500" />
                                <span className="font-bold">{filtered.length}</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                    {isDateMode
                                        ? (filtered.length === 1 ? 'licença/outorga no período' : 'licenças/outorgas no período')
                                        : (filtered.length === 1 ? 'alerta encontrado' : 'alertas encontrados')}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.print()}
                                    disabled={filtered.length === 0}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-500 text-white font-bold text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-500/30"
                                >
                                    <Printer size={16} />
                                    Imprimir
                                </button>
                                <button
                                    onClick={generatePDF}
                                    disabled={filtered.length === 0}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30"
                                >
                                    <Download size={16} />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabela */}
                    <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <div className="animate-spin mx-auto w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                                <p className="mt-4 text-sm">Carregando dados...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm font-medium">Nenhum alerta encontrado</p>
                                <p className="text-xs mt-1">Altere a regra ou a busca para ver resultados</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Razão Social</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">CNPJ</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Cidade</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Documento</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Órgão</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Processo/Nº</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Renovação</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Vencimento</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Dias p/ Venc.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((item, idx) => (
                                            <tr
                                                key={`${item.kind}-${item.id}`}
                                                className={`border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.01]' : ''}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${item.kind === 'licenca'
                                                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                        : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'}`}>
                                                        {item.kind === 'licenca' ? <FileText size={12} /> : <Droplets size={12} />}
                                                        {item.kind === 'licenca' ? 'Licença' : 'Outorga'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium">{item.razao_social}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">{item.cnpj || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                    {item.cidade ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPin size={12} className="text-slate-400" />
                                                            {item.cidade}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm">{item.tipo_documento}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.orgao || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.processo || item.numero_outorga || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {item.data_renovacao ? (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Calendar size={14} className="text-sky-500" />
                                                            <span className="font-semibold text-sky-700 dark:text-sky-400">{formatDate(item.data_renovacao)}</span>
                                                        </div>
                                                    ) : <span className="text-xs text-slate-400">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Calendar size={14} className="text-amber-500" />
                                                        <span className="font-semibold text-amber-700 dark:text-amber-400">{formatDate(item.validade)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.dias_restantes !== null ? (
                                                        <span className={`inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg text-xs font-bold ${item.dias_restantes <= 15
                                                            ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                                            : item.dias_restantes <= 45
                                                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                                : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
                                                            {item.dias_restantes} {item.dias_restantes === 1 ? 'dia' : 'dias'}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ABA GRÁFICOS
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'graficos' && (
                <>
                    {loading ? (
                        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                            <div className="animate-spin mx-auto w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
                            <p style={{ marginTop: 16, fontSize: 14 }}>Calculando gráficos...</p>
                        </div>
                    ) : (
                        <>
                            {/* Filtro de período dos gráficos */}
                            <div style={{
                                background: 'var(--card-bg)', border: '1px solid var(--border)',
                                borderRadius: 14, padding: '14px 18px',
                                boxShadow: 'var(--card-shadow)',
                                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Calendar size={14} style={{ color: 'var(--primary-fg)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Filtrar período</div>
                                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                                            {isChartDateMode ? 'Gráficos filtrados pelo período selecionado' : 'Exibindo toda a carteira'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 200, maxWidth: 400 }}>
                                    <DateRangePicker
                                        dateFrom={chartDateFrom}
                                        dateTo={chartDateTo}
                                        onChange={(from, to) => { setChartDateFrom(from); setChartDateTo(to) }}
                                    />
                                </div>
                                {isChartDateMode && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '5px 10px', borderRadius: 8,
                                        background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)',
                                        fontSize: 11.5, fontWeight: 600, color: 'var(--primary-fg)',
                                        flexShrink: 0,
                                    }}>
                                        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--primary-fg)', display: 'inline-block' }} />
                                        {chartFilteredLicencas.length + chartFilteredOutorgas.length} registros no período
                                    </div>
                                )}
                            </div>

                            {/* KPIs rápidos */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                                {[
                                    { label: 'Total na Carteira', value: totalCarteira, color: 'var(--primary-fg)', bg: 'var(--primary-soft)' },
                                    { label: 'Compliance', value: `${complianceRate}%`, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                                    { label: 'Vencendo', value: chartStatus[1].value, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                                    { label: 'Vencidas', value: chartStatus[2].value, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
                                ].map(kpi => (
                                    <div key={kpi.label} style={{
                                        background: 'var(--card-bg)', border: '1px solid var(--border)',
                                        borderRadius: 14, padding: '16px 18px',
                                        boxShadow: 'var(--card-shadow)',
                                    }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                                            {kpi.label}
                                        </div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, letterSpacing: -1 }}>
                                            {kpi.value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Grid de gráficos */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))', gap: 16 }}>

                                {/* ── Gráfico 1: Donut — Saúde da Carteira ── */}
                                <ChartCard
                                    title="Saúde da Carteira"
                                    subtitle="Distribuição atual por status de conformidade"
                                    icon={PieChartIcon}
                                    stat={`${complianceRate}%`}
                                    statLabel="em conformidade"
                                    statColor="#10b981"
                                    chartId="status"
                                    expandedId={expandedChart}
                                    onToggle={setExpandedChart}
                                >
                                    <div style={{ position: 'relative', height: '100%', minHeight: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={chartStatus}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={105}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    strokeWidth={0}
                                                    onClick={(entry: any) => handleDrillStatus(entry.name)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {chartStatus.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<PieTooltip />} />
                                                <Legend
                                                    formatter={(value, entry: any) => (
                                                        <span style={{ color: 'var(--text-mute)', fontSize: 12, fontWeight: 600 }}>
                                                            {value} <span style={{ color: entry.payload.color, fontWeight: 800 }}>{entry.payload.value}</span>
                                                        </span>
                                                    )}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Centro do donut */}
                                        <div style={{
                                            position: 'absolute', top: '50%', left: '50%',
                                            transform: 'translate(-50%, -62%)',
                                            textAlign: 'center', pointerEvents: 'none',
                                        }}>
                                            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-bright)', letterSpacing: -1 }}>
                                                {totalCarteira}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                                total
                                            </div>
                                        </div>
                                    </div>
                                </ChartCard>

                                {/* ── Gráfico 2: Area — Vencimentos por Mês ── */}
                                <ChartCard
                                    title="Ondas de Vencimento"
                                    subtitle="Licenças e outorgas que vencem por mês — próximos 12 meses"
                                    icon={TrendingUp}
                                    stat={chartVencimentos.reduce((s, m) => s + m.Licenças + m.Outorgas, 0)}
                                    statLabel="vencimentos mapeados"
                                    statColor="var(--primary-fg)"
                                    chartId="vencimentos"
                                    expandedId={expandedChart}
                                    onToggle={setExpandedChart}
                                >
                                    <div style={{ height: '100%', minHeight: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                    data={chartVencimentos}
                                                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={(data: any) => {
                                                        if (data?.activePayload?.[0]) {
                                                            const label = data.activeLabel
                                                            const found = chartVencimentos.find(m => m.mes === label)
                                                            if (found?._key && (found.Licenças + found.Outorgas) > 0) {
                                                                handleDrillMes(found._key, label)
                                                            }
                                                        }
                                                    }}
                                                >
                                                <defs>
                                                    <linearGradient id="gradLic" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                                    </linearGradient>
                                                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                                                <XAxis dataKey="mes" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip content={<ChartTooltip />} />
                                                <Legend formatter={(v) => <span style={{ color: 'var(--text-mute)', fontSize: 12 }}>{v}</span>} />
                                                <Area type="monotone" dataKey="Licenças" stroke="#10b981" strokeWidth={2} fill="url(#gradLic)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                                                <Area type="monotone" dataKey="Outorgas" stroke="#38bdf8" strokeWidth={2} fill="url(#gradOut)" dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                {/* ── Gráfico 3: Barra Horizontal — Por Tipo ── */}
                                <ChartCard
                                    title="Distribuição por Tipo"
                                    subtitle="Top 10 tipos de licença e outorga mais frequentes"
                                    icon={BarChart3}
                                    stat={chartTipos.length > 0 ? chartTipos[0].tipo : '—'}
                                    statLabel="tipo mais comum"
                                    statColor="var(--primary-fg)"
                                    chartId="tipos"
                                    expandedId={expandedChart}
                                    onToggle={setExpandedChart}
                                >
                                    <div style={{ height: '100%', minHeight: 280 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={chartTipos}
                                                layout="vertical"
                                                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                                                barSize={14}
                                                style={{ cursor: 'pointer' }}
                                                onClick={(data: any) => {
                                                    if (data?.activePayload?.[0]) {
                                                        handleDrillTipo(data.activePayload[0].payload.tipo)
                                                    }
                                                }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
                                                <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <YAxis
                                                    type="category" dataKey="tipo" width={68}
                                                    tick={{ fill: 'var(--text-mute)', fontSize: 11, fontWeight: 600 }}
                                                    tickLine={false} axisLine={false}
                                                    tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v}
                                                />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--primary-soft)' }} />
                                                <Bar dataKey="total" name="Qtde" radius={[0, 6, 6, 0]}>
                                                    {chartTipos.map((_, i) => {
                                                        const colors = ['#10b981','#34d399','#6ee7b7','#059669','#047857','#38bdf8','#0ea5e9','#f59e0b','#fbbf24','#f43f5e']
                                                        return <Cell key={i} fill={colors[i % colors.length]} />
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                {/* ── Gráfico 4: Barra — Por Cidade ── */}
                                <ChartCard
                                    title="Concentração Geográfica"
                                    subtitle="Top 10 municípios com mais licenças cadastradas"
                                    icon={MapPin}
                                    stat={chartCidades.length > 0 ? chartCidades[0].cidade : '—'}
                                    statLabel="cidade com mais licenças"
                                    statColor="var(--sky-fg)"
                                    chartId="cidades"
                                    expandedId={expandedChart}
                                    onToggle={setExpandedChart}
                                >
                                    <div style={{ height: '100%', minHeight: 280 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={chartCidades}
                                                margin={{ top: 0, right: 10, left: -20, bottom: 40 }}
                                                barSize={26}
                                                style={{ cursor: 'pointer' }}
                                                onClick={(data: any) => {
                                                    if (data?.activePayload?.[0]) {
                                                        handleDrillCidade(data.activePayload[0].payload.cidade)
                                                    }
                                                }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                                                <XAxis
                                                    dataKey="cidade"
                                                    tick={{ fill: 'var(--text-dim)', fontSize: 10, fontWeight: 600 }}
                                                    tickLine={false} axisLine={false}
                                                    angle={-35} textAnchor="end" interval={0}
                                                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                                                />
                                                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--primary-soft)' }} />
                                                <Bar dataKey="total" name="Licenças" radius={[6, 6, 0, 0]}>
                                                    {chartCidades.map((_, i) => {
                                                        const colors = ['#38bdf8','#0ea5e9','#0284c7','#7dd3fc','#bae6fd','#38bdf8','#22d3ee','#67e8f9','#a5f3fc','#cffafe']
                                                        return <Cell key={i} fill={colors[i % colors.length]} />
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                            </div>

                            {/* ── Painel de drill-down ── */}
                            {drill && (
                                <div className="animate-slide-up" style={{
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: 16, overflow: 'hidden',
                                    boxShadow: 'var(--card-shadow)',
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 20px', borderBottom: '1px solid var(--border)',
                                        background: 'var(--row-head)',
                                    }}>
                                        <span style={{
                                            width: 10, height: 10, borderRadius: 5,
                                            background: drill.color, flexShrink: 0, display: 'inline-block',
                                        }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: 14 }}>{drill.title}</span>
                                            <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>{drill.subtitle}</span>
                                        </div>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                                            background: drill.color + '22', color: drill.color,
                                            fontSize: 12, fontWeight: 700,
                                        }}>{drill.items.length} registros</span>
                                        {(drill.searchValue || drill.dateRange) && (
                                            <button
                                                onClick={() => {
                                                    if (drill.dateRange) {
                                                        setDateFrom(drill.dateRange.from)
                                                        setDateTo(drill.dateRange.to)
                                                    } else if (drill.searchValue) {
                                                        setSearch(drill.searchValue)
                                                    }
                                                    setActiveTab('relatorio')
                                                    setDrill(null)
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                                                    background: 'var(--primary)', color: 'var(--primary-ink)',
                                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                                    fontSize: 12, fontWeight: 700,
                                                }}
                                            >
                                                Ver no Relatório →
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDrill(null)}
                                            style={{
                                                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                                background: 'var(--neutral-bg)', border: '1px solid var(--border)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', color: 'var(--text-mute)',
                                            }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>

                                    {/* Tabela */}
                                    {drill.items.length === 0 ? (
                                        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                                            Nenhum registro encontrado para este filtro.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--row-head)', position: 'sticky', top: 0, zIndex: 1 }}>
                                                        {['Tipo', 'Razão Social', 'CNPJ', 'Cidade', 'Vencimento', 'Dias'].map(h => (
                                                            <th key={h} style={{
                                                                padding: '9px 14px', textAlign: 'left',
                                                                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8,
                                                                textTransform: 'uppercase', color: 'var(--text-dim)',
                                                                borderBottom: '1px solid var(--border)',
                                                                whiteSpace: 'nowrap',
                                                            }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {drill.items.slice(0, 60).map((item, i) => (
                                                        <tr key={i} style={{
                                                            borderBottom: '1px solid var(--divider)',
                                                            background: i % 2 === 1 ? 'var(--row-alt)' : 'transparent',
                                                        }}>
                                                            <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                                    background: item.kind === 'licenca' ? 'rgba(99,102,241,0.12)' : 'rgba(6,182,212,0.12)',
                                                                    color: item.kind === 'licenca' ? '#818cf8' : '#22d3ee',
                                                                }}>
                                                                    {item.kind === 'licenca' ? <FileText size={10} /> : <Droplets size={10} />}
                                                                    {item.tipo}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {item.razao_social}
                                                            </td>
                                                            <td style={{ padding: '8px 14px', color: 'var(--text-mute)', fontFamily: 'monospace', fontSize: 11 }}>
                                                                {item.cnpj || '—'}
                                                            </td>
                                                            <td style={{ padding: '8px 14px', color: 'var(--text-mute)' }}>
                                                                {item.cidade || '—'}
                                                            </td>
                                                            <td style={{ padding: '8px 14px', color: 'var(--amber-fg)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                {formatDate(item.validade)}
                                                            </td>
                                                            <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                                                                {item.dias_restantes !== null ? (
                                                                    <span style={{
                                                                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                                        background: item.dias_restantes <= 0 ? 'var(--rose-soft)' : item.dias_restantes <= 45 ? 'var(--amber-soft)' : 'var(--primary-soft)',
                                                                        color: item.dias_restantes <= 0 ? 'var(--rose-fg)' : item.dias_restantes <= 45 ? 'var(--amber-fg)' : 'var(--primary-fg)',
                                                                    }}>
                                                                        {item.dias_restantes}d
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {drill.items.length > 60 && (
                                                <div style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
                                                    Mostrando 60 de {drill.items.length} registros · Use "Ver no Relatório" para ver todos
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}
