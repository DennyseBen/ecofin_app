import { useState, useEffect, useMemo } from 'react'
import { Bell, AlertTriangle, Clock, CheckCircle2, FileText, Droplets, ArrowUpRight, RefreshCw, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchAlertasLicencas, fetchAlertasOutorgas } from '../lib/api'
import { isInAlertZone, getDaysRemaining, getAlertDays, statusBadgeClass, computeStatus } from '../lib/types'
import type { Licenca, Outorga } from '../lib/types'

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

type AlertItem = {
    kind: 'licenca' | 'outorga'
    id: number
    razao_social: string
    tipo: string
    validade: string | null
    data_renovacao: string | null
    departamento?: string | null
    daysRemaining: number | null
    alertDays: number
}

function urgencyColor(days: number | null): string {
    if (days === null) return 'border-slate-200 dark:border-white/10'
    if (days <= 15) return 'border-red-400'
    if (days <= 45) return 'border-amber-400'
    return 'border-emerald-400'
}

function urgencyBg(days: number | null): string {
    if (days === null) return ''
    if (days <= 15) return 'bg-red-50 dark:bg-red-500/[0.06]'
    if (days <= 45) return 'bg-amber-50 dark:bg-amber-500/[0.05]'
    return 'bg-emerald-50/50 dark:bg-emerald-500/[0.04]'
}

function UrgencyBadge({ days }: { days: number | null }) {
    if (days === null) return null
    if (days <= 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">VENCIDA</span>
    if (days <= 15) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">CRÍTICO • {days}d</span>
    if (days <= 45) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">URGENTE • {days}d</span>
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">ATENÇÃO • {days}d</span>
}

export default function Notificacoes() {
    const navigate = useNavigate()
    const [licencas, setLicencas] = useState<Licenca[]>([])
    const [outorgas, setOutorgas] = useState<Outorga[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'todos' | '30dias' | '60dias' | 'critico'>('todos')

    const load = async () => {
        setLoading(true)
        const [l, o] = await Promise.all([
            fetchAlertasLicencas().catch(() => [] as Licenca[]),
            fetchAlertasOutorgas().catch(() => [] as Outorga[]),
        ])
        setLicencas(l)
        setOutorgas(o)
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const alertItems = useMemo((): AlertItem[] => {
        const items: AlertItem[] = []

        for (const l of licencas) {
            if (!isInAlertZone(l)) continue
            items.push({
                kind: 'licenca',
                id: l.id,
                razao_social: l.razao_social,
                tipo: l.tipo,
                validade: l.validade,
                data_renovacao: l.data_renovacao,
                departamento: l.departamento,
                daysRemaining: getDaysRemaining(l),
                alertDays: getAlertDays(l.tipo),
            })
        }

        for (const o of outorgas) {
            if (!isInAlertZone(o)) continue
            items.push({
                kind: 'outorga',
                id: o.id,
                razao_social: o.razao_social,
                tipo: o.tipo,
                validade: o.validade,
                data_renovacao: o.data_renovacao,
                departamento: o.orgao,
                daysRemaining: getDaysRemaining(o),
                alertDays: getAlertDays('OUTORGA'),
            })
        }

        return items.sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    }, [licencas, outorgas])

    const filtered = useMemo(() => {
        return alertItems.filter(item => {
            const d = item.daysRemaining ?? 999
            if (filter === 'critico') return d <= 15
            if (filter === '30dias') return d <= 30
            if (filter === '60dias') return d <= 60
            return true
        })
    }, [alertItems, filter])

    // Grouped by urgency
    const criticos = filtered.filter(i => (i.daysRemaining ?? 999) <= 15)
    const urgentes = filtered.filter(i => { const d = i.daysRemaining ?? 999; return d > 15 && d <= 45 })
    const atencao = filtered.filter(i => (i.daysRemaining ?? 999) > 45)

    const AlertCard = ({ item }: { item: AlertItem }) => (
        <div
            className={`border-l-4 rounded-2xl p-4 cursor-pointer hover:opacity-90 transition-opacity ${urgencyColor(item.daysRemaining)} ${urgencyBg(item.daysRemaining)}`}
            onClick={() => navigate(item.kind === 'licenca' ? `/licencas?id=${item.id}` : `/licencas?tab=outorgas`)}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="p-1.5 rounded-xl bg-white/70 dark:bg-white/[0.06] shrink-0 mt-0.5">
                        {item.kind === 'outorga'
                            ? <Droplets size={14} className="text-sky-500" />
                            : <FileText size={14} className="text-emerald-500" />
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{item.razao_social}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-xl bg-white/60 dark:bg-white/[0.06] text-[10px] font-bold tracking-wider">
                                {item.kind === 'outorga' ? 'OUTORGA' : item.tipo}
                            </span>
                            {item.departamento && (
                                <span className="text-[11px] text-slate-400">{item.departamento}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <UrgencyBadge days={item.daysRemaining} />
                    <span className="text-[10px] text-slate-400">Vence {formatDate(item.validade)}</span>
                    {item.data_renovacao && (
                        <span className="text-[10px] text-sky-500">Renovar até {formatDate(item.data_renovacao)}</span>
                    )}
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1 text-[10px] text-slate-400">
                <Clock size={10} />
                <span>Prazo de antecedência configurado: <strong>{item.alertDays} dias</strong></span>
                <ArrowUpRight size={10} className="ml-auto" />
            </div>
        </div>
    )

    const Section = ({ title, items, color }: { title: string; items: AlertItem[]; color: string }) => {
        if (items.length === 0) return null
        return (
            <div>
                <div className={`flex items-center gap-2 mb-3`}>
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <h3 className="font-bold text-sm">{title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-3">
                    {items.map((item, i) => <AlertCard key={`${item.kind}-${item.id}-${i}`} item={item} />)}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-amber-500 mb-1">
                        <Bell size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Central de Alertas</span>
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Notificações</h1>
                    <p className="text-slate-400 text-sm">
                        {alertItems.length > 0
                            ? `${alertItems.length} item${alertItems.length > 1 ? 'ns' : ''} requer${alertItems.length === 1 ? '' : 'em'} atenção`
                            : 'Tudo em dia — nenhum alerta ativo'}
                    </p>
                </div>
                <button onClick={load} disabled={loading} className="btn-ghost !h-9 gap-2">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Thresholds legend */}
            <div className="card !p-4">
                <p className="text-xs font-semibold text-slate-500 mb-3">Regras de antecedência configuradas</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-transparent">
                        <p className="text-xl font-extrabold text-sky-500">60</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">dias</p>
                        <p className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 mt-1">RIAA / RAL<br />CEPROF / ANM</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-transparent">
                        <p className="text-xl font-extrabold text-amber-500">120</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">dias</p>
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-1">LO / LP / LI<br />ASV / Supressão</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-transparent">
                        <p className="text-xl font-extrabold text-emerald-500">180</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">dias</p>
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Outorgas<br />(hídrico)</p>
                    </div>
                    <button
                        onClick={() => alert('Em breve: Formulário dinâmico para criação de nova regra personalizada.')}
                        className="text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center transition-all group"
                    >
                        <div className="bg-slate-200/50 dark:bg-white/10 p-1.5 rounded-full mb-2 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                            <Plus size={16} />
                        </div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nova Regra</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Criar / Configurar</p>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'todos', label: `Todos (${alertItems.length})` },
                    { key: 'critico', label: `Crítico ≤15d (${alertItems.filter(i => (i.daysRemaining ?? 999) <= 15).length})` },
                    { key: '30dias', label: `Próximos 30d (${alertItems.filter(i => (i.daysRemaining ?? 999) <= 30).length})` },
                    { key: '60dias', label: `Próximos 60d (${alertItems.filter(i => (i.daysRemaining ?? 999) <= 60).length})` },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={filter === key ? 'pill-tab-active' : 'pill-tab'}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 size={48} className="text-emerald-400 mb-4" />
                    <h3 className="font-bold text-lg">Nenhum alerta no período</h3>
                    <p className="text-slate-400 text-sm mt-1">Todas as licenças e outorgas estão dentro do prazo seguro.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <Section title="Crítico — ação imediata necessária" items={criticos} color="bg-red-500" />
                    <Section title="Urgente — iniciar processo de renovação" items={urgentes} color="bg-amber-500" />
                    <Section title="Em atenção — dentro do prazo de antecedência" items={atencao} color="bg-emerald-500" />
                </div>
            )}

            {/* Info box */}
            <div className="card !bg-slate-50 dark:!bg-white/[0.02] !border-dashed">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold">Notificações automáticas por e-mail e WhatsApp</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Configure seu e-mail e número de WhatsApp em{' '}
                            <button onClick={() => navigate('/configuracoes')} className="text-emerald-500 hover:underline font-medium">
                                Configurações → Notificações
                            </button>{' '}
                            para receber alertas automaticamente quando um prazo se aproximar.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
