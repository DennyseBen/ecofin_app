import { useState, useEffect, useMemo } from 'react'
import { Bell, AlertTriangle, Clock, CheckCircle2, FileText, Droplets, ArrowUpRight, RefreshCw, Plus, X, Save, Edit2, Trash2, Zap, Mail, MessageSquare, Monitor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchAlertasLicencas, fetchAlertasOutorgas } from '../lib/api'
import { isInAlertZone, getDaysRemaining, getAlertDays } from '../lib/types'
import { loadJson, saveJson } from '../lib/storage'
import type { Licenca, Outorga } from '../lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type RegraNotificacao = {
    id: string
    nome: string
    tipos: string[]
    dias: number
    cor: 'sky' | 'amber' | 'emerald' | 'violet' | 'rose' | 'indigo'
    canais: ('sistema' | 'email' | 'whatsapp')[]
    custom: boolean
    ativo: boolean
    descricao?: string
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

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ecofin.regras.v1'

const ALL_TIPOS = [
    'LP', 'LI', 'LO', 'CLUA', 'Dispensa de Outorga', 'ASV', 'AUV', 'LAR',
    'Supressão', 'Licença Prefeito', 'ANM', 'CEPROF', 'Registro ANM',
    'RIAA', 'RAL', 'OUTORGA',
]

const BUILTIN_RULES: RegraNotificacao[] = [
    {
        id: 'builtin-60', nome: 'Curto prazo',
        tipos: ['ANM', 'CEPROF', 'Registro ANM', 'RIAA', 'RAL'],
        dias: 60, cor: 'sky', canais: ['sistema'], custom: false, ativo: true,
        descricao: 'Licenças com ciclo curto de renovação',
    },
    {
        id: 'builtin-120', nome: 'Prazo padrão',
        tipos: ['LO', 'LP', 'LI', 'ASV', 'AUV', 'LAR', 'Supressão', 'CLUA', 'Dispensa de Outorga', 'Licença Prefeito'],
        dias: 120, cor: 'amber', canais: ['sistema'], custom: false, ativo: true,
        descricao: 'Principais licenças ambientais estaduais/federais',
    },
    {
        id: 'builtin-180', nome: 'Outorgas hídricas',
        tipos: ['OUTORGA'],
        dias: 180, cor: 'emerald', canais: ['sistema'], custom: false, ativo: true,
        descricao: 'Outorgas de uso de recursos hídricos',
    },
]

const COR_PALETTE: RegraNotificacao['cor'][] = ['sky', 'amber', 'emerald', 'violet', 'rose', 'indigo']

const COR_MAP: Record<RegraNotificacao['cor'], { bg: string; text: string; border: string; badge: string }> = {
    sky: { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-300 dark:border-sky-700', badge: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-300 dark:border-violet-700', badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-700', badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-300 dark:border-indigo-700', badge: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
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

function newCustomRule(): RegraNotificacao {
    return {
        id: `custom-${Date.now()}`,
        nome: '',
        tipos: [],
        dias: 90,
        cor: 'violet',
        canais: ['sistema'],
        custom: true,
        ativo: true,
        descricao: '',
    }
}

// ─── Rule Form Panel ──────────────────────────────────────────────────────────

function RuleFormPanel({
    rule,
    onSave,
    onClose,
    onDelete,
}: {
    rule: RegraNotificacao
    onSave: (r: RegraNotificacao) => void
    onClose: () => void
    onDelete?: (id: string) => void
}) {
    const [form, setForm] = useState<RegraNotificacao>({ ...rule })

    const toggleTipo = (tipo: string) => {
        setForm(f => ({
            ...f,
            tipos: f.tipos.includes(tipo) ? f.tipos.filter(t => t !== tipo) : [...f.tipos, tipo],
        }))
    }

    const toggleCanal = (canal: 'sistema' | 'email' | 'whatsapp') => {
        setForm(f => ({
            ...f,
            canais: f.canais.includes(canal) ? f.canais.filter(c => c !== canal) : [...f.canais, canal],
        }))
    }

    const canSave = form.nome.trim().length > 0 && form.tipos.length > 0 && form.dias > 0

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/40" onClick={onClose} />

            {/* Panel */}
            <div className="w-full max-w-md bg-white dark:bg-[#0f172a] shadow-2xl flex flex-col overflow-y-auto animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/[0.06] sticky top-0 bg-white dark:bg-[#0f172a] z-10">
                    <div className="flex items-center gap-2">
                        <Zap size={18} className="text-emerald-500" />
                        <h2 className="font-bold text-base">
                            {rule.custom ? (rule.id.startsWith('custom-new') ? 'Nova Regra' : 'Editar Regra') : `Regra: ${rule.nome}`}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-5 flex-1">
                    {/* Nome */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Nome da regra *</label>
                        <input
                            className="form-input"
                            placeholder="Ex: Licenças críticas estaduais"
                            value={form.nome}
                            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                            disabled={!form.custom}
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descrição</label>
                        <input
                            className="form-input"
                            placeholder="Breve descrição desta regra"
                            value={form.descricao || ''}
                            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                        />
                    </div>

                    {/* Dias */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                            Antecedência de alerta: <span className="text-emerald-500">{form.dias} dias</span>
                        </label>
                        <input
                            type="range"
                            min={15} max={365} step={15}
                            value={form.dias}
                            onChange={e => setForm(f => ({ ...f, dias: Number(e.target.value) }))}
                            className="w-full accent-emerald-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                            <span>15d</span><span>90d</span><span>180d</span><span>365d</span>
                        </div>
                    </div>

                    {/* Tipos */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block">
                            Tipos de licença/outorga *{' '}
                            <span className="font-normal text-slate-400">({form.tipos.length} selecionados)</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {ALL_TIPOS.map(tipo => {
                                const selected = form.tipos.includes(tipo)
                                return (
                                    <button
                                        key={tipo}
                                        onClick={() => toggleTipo(tipo)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${selected
                                                ? 'bg-emerald-500 text-white border-emerald-500'
                                                : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        {tipo}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Cor */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block">Cor do card</label>
                        <div className="flex gap-2">
                            {COR_PALETTE.map(cor => (
                                <button
                                    key={cor}
                                    onClick={() => setForm(f => ({ ...f, cor }))}
                                    className={`w-7 h-7 rounded-full border-2 transition-transform ${COR_MAP[cor].bg.split(' ')[0].replace('bg-', 'bg-').replace('50', '400').replace('500/10', '400')
                                        } ${form.cor === cor ? 'scale-125 border-slate-900 dark:border-white' : 'border-transparent'}`}
                                    style={{ backgroundColor: cor === 'sky' ? '#38bdf8' : cor === 'amber' ? '#fbbf24' : cor === 'emerald' ? '#34d399' : cor === 'violet' ? '#a78bfa' : cor === 'rose' ? '#fb7185' : '#818cf8' }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Canais */}
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block">Canais de notificação</label>
                        <div className="space-y-2">
                            {([
                                { key: 'sistema' as const, icon: <Monitor size={14} />, label: 'Sistema (Central de alertas)' },
                                { key: 'email' as const, icon: <Mail size={14} />, label: 'E-mail' },
                                { key: 'whatsapp' as const, icon: <MessageSquare size={14} />, label: 'WhatsApp' },
                            ]).map(({ key, icon, label }) => {
                                const active = form.canais.includes(key)
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleCanal(key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${active
                                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        <span className={active ? 'text-emerald-500' : 'text-slate-400'}>{icon}</span>
                                        {label}
                                        <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                                            {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Ativo */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                        <span className="text-sm font-medium">Regra ativa</span>
                        <button
                            onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                            className={`relative w-11 h-6 rounded-full transition-colors ${form.ativo ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 dark:border-white/[0.06] flex gap-3 sticky bottom-0 bg-white dark:bg-[#0f172a]">
                    {form.custom && onDelete && !form.id.includes('new') && (
                        <button
                            onClick={() => { onDelete(form.id); onClose() }}
                            className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button onClick={onClose} className="flex-1 btn-ghost">Cancelar</button>
                    <button
                        onClick={() => { if (canSave) onSave(form) }}
                        disabled={!canSave}
                        className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Save size={15} />
                        Salvar Regra
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ item, onClick }: { item: AlertItem; onClick: () => void }) {
    return (
        <div
            className={`border-l-4 rounded-2xl p-4 cursor-pointer hover:opacity-90 transition-opacity ${urgencyColor(item.daysRemaining)} ${urgencyBg(item.daysRemaining)}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="p-1.5 rounded-xl bg-white/70 dark:bg-white/[0.06] shrink-0 mt-0.5">
                        {item.kind === 'outorga'
                            ? <Droplets size={14} className="text-sky-500" />
                            : <FileText size={14} className="text-emerald-500" />}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{item.razao_social}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-xl bg-white/60 dark:bg-white/[0.06] text-[10px] font-bold tracking-wider">
                                {item.kind === 'outorga' ? 'OUTORGA' : item.tipo}
                            </span>
                            {item.departamento && <span className="text-[11px] text-slate-400">{item.departamento}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <UrgencyBadge days={item.daysRemaining} />
                    <span className="text-[10px] text-slate-400">Vence {formatDate(item.validade)}</span>
                    {item.data_renovacao && <span className="text-[10px] text-sky-500">Renovar até {formatDate(item.data_renovacao)}</span>}
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1 text-[10px] text-slate-400">
                <Clock size={10} />
                <span>Prazo de antecedência: <strong>{item.alertDays} dias</strong></span>
                <ArrowUpRight size={10} className="ml-auto" />
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Notificacoes() {
    const navigate = useNavigate()
    const [licencas, setLicencas] = useState<Licenca[]>([])
    const [outorgas, setOutorgas] = useState<Outorga[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'todos' | '30dias' | '60dias' | 'critico'>('todos')
    const [activeRuleId, setActiveRuleId] = useState<string | null>(null)
    const [panelRule, setPanelRule] = useState<RegraNotificacao | null>(null)
    const [customRules, setCustomRules] = useState<RegraNotificacao[]>([])

    // Load custom rules from localStorage
    useEffect(() => {
        setCustomRules(loadJson<RegraNotificacao[]>(STORAGE_KEY, []))
    }, [])

    const saveCustomRules = (rules: RegraNotificacao[]) => {
        setCustomRules(rules)
        saveJson(STORAGE_KEY, rules)
    }

    const allRules = useMemo(() => [...BUILTIN_RULES, ...customRules], [customRules])

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
                kind: 'licenca', id: l.id,
                razao_social: l.razao_social, tipo: l.tipo,
                validade: l.validade, data_renovacao: l.data_renovacao,
                departamento: l.departamento,
                daysRemaining: getDaysRemaining(l),
                alertDays: getAlertDays(l.tipo),
            })
        }
        for (const o of outorgas) {
            if (!isInAlertZone(o)) continue
            items.push({
                kind: 'outorga', id: o.id,
                razao_social: o.razao_social, tipo: o.tipo,
                validade: o.validade, data_renovacao: o.data_renovacao,
                departamento: o.orgao,
                daysRemaining: getDaysRemaining(o),
                alertDays: getAlertDays('OUTORGA'),
            })
        }
        return items.sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    }, [licencas, outorgas])

    // Items matching selected rule filter
    const ruleFiltered = useMemo(() => {
        if (!activeRuleId) return alertItems
        const rule = allRules.find(r => r.id === activeRuleId)
        if (!rule) return alertItems
        return alertItems.filter(item => {
            const itemTipo = item.kind === 'outorga' ? 'OUTORGA' : item.tipo
            return rule.tipos.includes(itemTipo)
        })
    }, [alertItems, activeRuleId, allRules])

    // Then apply urgency filter
    const filtered = useMemo(() => {
        return ruleFiltered.filter(item => {
            const d = item.daysRemaining ?? 999
            if (filter === 'critico') return d <= 15
            if (filter === '30dias') return d <= 30
            if (filter === '60dias') return d <= 60
            return true
        })
    }, [ruleFiltered, filter])

    const criticos = filtered.filter(i => (i.daysRemaining ?? 999) <= 15)
    const urgentes = filtered.filter(i => { const d = i.daysRemaining ?? 999; return d > 15 && d <= 45 })
    const atencao = filtered.filter(i => (i.daysRemaining ?? 999) > 45)

    const handleRuleClick = (ruleId: string) => {
        setActiveRuleId(prev => prev === ruleId ? null : ruleId)
    }

    const handleSaveRule = (rule: RegraNotificacao) => {
        const existing = customRules.findIndex(r => r.id === rule.id)
        if (existing >= 0) {
            const updated = [...customRules]
            updated[existing] = rule
            saveCustomRules(updated)
        } else {
            saveCustomRules([...customRules, rule])
        }
        setPanelRule(null)
    }

    const handleDeleteRule = (id: string) => {
        saveCustomRules(customRules.filter(r => r.id !== id))
        if (activeRuleId === id) setActiveRuleId(null)
    }

    const Section = ({ title, items, color }: { title: string; items: AlertItem[]; color: string }) => {
        if (items.length === 0) return null
        return (
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <h3 className="font-bold text-sm">{title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-3">
                    {items.map((item, i) => (
                        <AlertCard
                            key={`${item.kind}-${item.id}-${i}`}
                            item={item}
                            onClick={() => navigate(item.kind === 'licenca' ? `/licencas?id=${item.id}` : `/licencas?tab=outorgas`)}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl">
            {/* Header */}
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
                        {activeRuleId && (
                            <span className="ml-2 text-emerald-500 font-medium">
                                · filtrado por regra ({ruleFiltered.length})
                            </span>
                        )}
                    </p>
                </div>
                <button onClick={load} disabled={loading} className="btn-ghost !h-9 gap-2">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Rule Cards */}
            <div className="card !p-4">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500">Regras de antecedência — clique para filtrar</p>
                    {activeRuleId && (
                        <button
                            onClick={() => setActiveRuleId(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                        >
                            <X size={10} /> Limpar filtro
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {allRules.map(rule => {
                        const isActive = activeRuleId === rule.id
                        const c = COR_MAP[rule.cor]
                        const matchCount = alertItems.filter(item => {
                            const t = item.kind === 'outorga' ? 'OUTORGA' : item.tipo
                            return rule.tipos.includes(t)
                        }).length
                        return (
                            <div key={rule.id} className="relative group">
                                <button
                                    onClick={() => handleRuleClick(rule.id)}
                                    className={`w-full text-center p-3 rounded-xl border transition-all ${isActive
                                            ? `${c.bg} ${c.border} border-2 scale-[1.02] shadow-sm`
                                            : `bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:${c.bg} hover:${c.border}`
                                        }`}
                                    title={rule.descricao || rule.nome}
                                >
                                    <p className={`text-xl font-extrabold ${c.text}`}>{rule.dias}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">dias</p>
                                    <p className={`text-[10px] font-semibold mt-1 ${c.text}`}>
                                        {rule.nome}
                                    </p>
                                    {matchCount > 0 && (
                                        <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${c.badge}`}>
                                            {matchCount} alerta{matchCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {!rule.ativo && (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] bg-slate-100 text-slate-400">inativa</span>
                                    )}
                                </button>
                                {/* Edit icon on hover */}
                                <button
                                    onClick={e => { e.stopPropagation(); setPanelRule(rule) }}
                                    className="absolute top-1.5 right-1.5 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white dark:hover:bg-white/10 transition-all"
                                    title="Editar regra"
                                >
                                    <Edit2 size={10} className="text-slate-400" />
                                </button>
                            </div>
                        )
                    })}

                    {/* + Nova Regra */}
                    <button
                        onClick={() => setPanelRule({ ...newCustomRule(), id: 'custom-new-' + Date.now() })}
                        className="text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center transition-all group"
                    >
                        <div className="bg-slate-200/50 dark:bg-white/10 p-1.5 rounded-full mb-2 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                            <Plus size={16} />
                        </div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nova Regra</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Personalizada</p>
                    </button>
                </div>
            </div>

            {/* Urgency filters */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { key: 'todos', label: `Todos (${ruleFiltered.length})` },
                    { key: 'critico', label: `Crítico ≤15d (${ruleFiltered.filter(i => (i.daysRemaining ?? 999) <= 15).length})` },
                    { key: '30dias', label: `Próximos 30d (${ruleFiltered.filter(i => (i.daysRemaining ?? 999) <= 30).length})` },
                    { key: '60dias', label: `Próximos 60d (${ruleFiltered.filter(i => (i.daysRemaining ?? 999) <= 60).length})` },
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

            {/* Alert list */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 size={48} className="text-emerald-400 mb-4" />
                    <h3 className="font-bold text-lg">
                        {activeRuleId ? 'Nenhum alerta para esta regra' : 'Nenhum alerta no período'}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                        {activeRuleId
                            ? 'Todas as licenças desta categoria estão dentro do prazo seguro.'
                            : 'Todas as licenças e outorgas estão dentro do prazo seguro.'}
                    </p>
                    {activeRuleId && (
                        <button onClick={() => setActiveRuleId(null)} className="mt-4 btn-ghost text-sm">
                            Ver todos os alertas
                        </button>
                    )}
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
                            para receber alertas automaticamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Rule form panel */}
            {panelRule && (
                <RuleFormPanel
                    rule={panelRule}
                    onSave={rule => {
                        // If it's a built-in rule being "saved" (only editable fields), treat as custom override
                        if (!rule.custom) {
                            // Only save dias/canais/ativo changes — update built-in locally via custom override
                            const override: RegraNotificacao = { ...rule, id: `override-${rule.id}`, custom: true }
                            handleSaveRule(override)
                        } else {
                            handleSaveRule(rule)
                        }
                        setPanelRule(null)
                    }}
                    onClose={() => setPanelRule(null)}
                    onDelete={handleDeleteRule}
                />
            )}
        </div>
    )
}
