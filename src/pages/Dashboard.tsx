import { Users, AlertTriangle, ShieldCheck, ArrowUpRight, Leaf, Activity, Bell } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '../hooks/useSupabase'
import { useRealtime } from '../hooks/useRealtime'
import { fetchDashboardStats, fetchLicencasPorTipo, fetchProximosVencimentos, fetchAlertasLicencas, fetchKanbanCards, fetchOutorgas } from '../lib/api'
import { computeStatus, statusBadgeClass, getDaysRemaining, isInAlertZone } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('T')[0].split('-')
    return `${d}/${m}/${y}`
}

function ComplianceGauge({ value, title = "Conformidade" }: { value: number; title?: string }) {
    const radius = 80
    const circumference = Math.PI * radius
    const offset = circumference - (value / 100) * circumference
    const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444'
    return (
        <div className="relative flex flex-col items-center">
            <svg className="w-full max-w-[160px] h-auto" viewBox="0 0 200 120">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-white/[0.06]" strokeLinecap="round" />
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="animate-gauge" style={{ filter: `drop-shadow(0 0 8px ${color}40)` }} />
            </svg>
            <div className="absolute bottom-2 flex flex-col items-center">
                <span className="text-4xl font-extrabold" style={{ color }}>{value}%</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-0.5">{title}</span>
            </div>
        </div>
    )
}

function TimelineStep({ label, count, active }: { label: string; count: number; active?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400'}`}>
                {count}
            </div>
            <span className="text-[10px] font-medium text-slate-400 text-center max-w-[80px] leading-tight">{label}</span>
        </div>
    )
}

function MiniProgress({ value, color }: { value: number; color: string }) {
    return (
        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${value}%` }} />
        </div>
    )
}

const tabs = ['Visão Geral', 'Vencimentos', 'Atividade']

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('Visão Geral')
    const navigate = useNavigate()
    const { user } = useAuth()
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'

    const { data: stats, loading: statsLoading, refetch: refetchStats } = useSupabase(fetchDashboardStats, {
        total_clientes: 0, total_licencas: 0, licencas_validas: 0,
        licencas_vencidas: 0, vencendo_90_dias: 0, compliance_rate: 0
    })
    const { data: licencasPorTipo, refetch: refetchTipo } = useSupabase(fetchLicencasPorTipo, [])
    const { data: recentExpiring, refetch: refetchExpiring } = useSupabase(() => fetchProximosVencimentos(8), [])
    const { data: alertasLicencas, refetch: refetchAlertas } = useSupabase(fetchAlertasLicencas, [])
    const { data: kanbanCards, refetch: refetchKanban } = useSupabase(fetchKanbanCards, [])
    const { data: outorgas, refetch: refetchOutorgas } = useSupabase(fetchOutorgas, [])

    const refetchAll = useCallback(() => {
        refetchStats(); refetchTipo(); refetchExpiring(); refetchAlertas(); refetchKanban(); refetchOutorgas()
    }, [refetchStats, refetchTipo, refetchExpiring, refetchAlertas, refetchKanban, refetchOutorgas])
    useRealtime(['licencas', 'outorgas', 'kanban_cards'], refetchAll)
    const alertItems = alertasLicencas.filter(isInAlertZone).slice(0, 5)

    // Contadores dinâmicos do Kanban
    const stages = {
        planejamento: kanbanCards.filter(c => c.stage === 'planejamento').length,
        coleta: kanbanCards.filter(c => c.stage === 'coleta' || c.stage === 'preenchimento').length,
        protocolado: kanbanCards.filter(c => c.stage === 'protocolado').length,
        exigencias: kanbanCards.filter(c => c.stage === 'exigencias' || c.stage === 'analise').length,
        concluido: kanbanCards.filter(c => c.stage === 'concluido').length
    }

    // Calcula compliance Outorgas
    const outorgasValidas = outorgas.filter(o => computeStatus(o) === 'Válida' || computeStatus(o) === 'Vencendo').length
    const statsOutorgas = {
        total: outorgas.length,
        validas: outorgasValidas,
        vencendo: outorgas.filter(o => computeStatus(o) === 'Vencendo').length,
        vencidas: outorgas.filter(o => computeStatus(o) === 'Vencida').length,
        compliance: outorgas.length > 0 ? Math.round((outorgasValidas / outorgas.length) * 100) : 0
    }

    const getChartColor = (type: string) => {
        const t = type.toUpperCase()
        if (t.includes('LO')) return 'bg-emerald-500'
        if (t.includes('LI')) return 'bg-sky-500'
        if (t.includes('DLA')) return 'bg-amber-500'
        if (t.includes('LP')) return 'bg-violet-500'
        return 'bg-blue-400'
    }

    if (statsLoading) {
        return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>
    }

    const kpis = [
        { label: 'Total Clientes', value: stats.total_clientes, icon: Users, desc: 'Cadastrados no sistema', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-500', path: '/clientes' },
        { label: 'Licenças Ativas', value: stats.licencas_validas, icon: ShieldCheck, desc: 'Em conformidade', iconBg: 'bg-sky-50 dark:bg-sky-500/10', iconColor: 'text-sky-500', path: '/licencas?status=Válida' },
        { label: 'Vencendo em 90 dias', value: stats.vencendo_90_dias, icon: AlertTriangle, desc: 'Requer atenção', iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconColor: 'text-amber-500', path: '/licencas?status=Vencendo' },
        { label: 'Total Processos', value: stats.total_licencas, icon: Activity, desc: 'Licenças registradas', iconBg: 'bg-violet-50 dark:bg-violet-500/10', iconColor: 'text-violet-500', path: '/licencas' },
    ]

    return (
        <div className="space-y-8 animate-fade-in">

            {/* Alert Banner */}
            {alertItems.length > 0 && (
                <div className="card !bg-amber-50 dark:!bg-amber-500/[0.08] !border-amber-200 dark:!border-amber-500/20 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/notificacoes')}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/20">
                                <Bell size={15} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                                {alertItems.length} licença{alertItems.length > 1 ? 's precisam' : ' precisa'} de atenção
                            </p>
                        </div>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            Ver todas <ArrowUpRight size={12} />
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {alertItems.map((l, i) => {
                            const days = getDaysRemaining(l)
                            return (
                                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-amber-200/50 dark:border-amber-500/10 last:border-0">
                                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[60%]">{l.razao_social}</span>
                                    <span className={`font-bold px-2 py-0.5 rounded-full ${days !== null && days <= 15 ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                        {days !== null && days >= 0 ? `${days}d` : 'Vencida'} · {l.tipo}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-emerald-500 mb-1"><Leaf size={18} /><span className="text-xs font-bold uppercase tracking-widest">EcoFin Manager</span></div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Olá, {userName} 👋</h1>
                    <p className="text-slate-400 text-sm mt-1">Monitoramento de licenciamento ambiental em tempo real.</p>
                </div>
                <div className="flex gap-1 bg-slate-100 dark:bg-white/[0.04] rounded-full p-1">
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'pill-tab-active' : 'pill-tab'}>{tab}</button>
                    ))}
                </div>
            </div>

            {(activeTab === 'Visão Geral' || activeTab === 'Vencimentos') && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* KPIs principais */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="card-hover cursor-pointer animate-slide-up" style={{ animationDelay: `${i * 80}ms` }} onClick={() => navigate(kpi.path)}>
                                <div className="flex items-start justify-between">
                                    <div className={`p-2.5 rounded-2xl ${kpi.iconBg}`}><kpi.icon size={20} className={kpi.iconColor} /></div>
                                    <ArrowUpRight size={16} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-3xl font-extrabold mt-4">{kpi.value}</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{kpi.label}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{kpi.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Paineis de Conformidade Individuais */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {/* Licenças */}
                        <div className="card flex flex-col items-center justify-center py-5">
                            <ComplianceGauge value={stats.compliance_rate} title="Conformidade Licenças" />
                            <div className="grid grid-cols-3 gap-2 mt-4 w-full px-2">
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?status=Válida')}>
                                    <p className="text-sm font-bold text-emerald-500">{stats.licencas_validas}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Válidas</p>
                                </div>
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?status=Vencendo')}>
                                    <p className="text-sm font-bold text-amber-500">{stats.vencendo_90_dias}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Vencendo</p>
                                </div>
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?status=Vencida')}>
                                    <p className="text-sm font-bold text-red-500">{stats.licencas_vencidas}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Vencidas</p>
                                </div>
                            </div>
                        </div>

                        {/* Outorgas */}
                        <div className="card flex flex-col items-center justify-center py-5">
                            <ComplianceGauge value={statsOutorgas.compliance} title="Conformidade Outorgas" />
                            <div className="grid grid-cols-3 gap-2 mt-4 w-full px-2">
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?tab=outorgas&status=Válida')}>
                                    <p className="text-sm font-bold text-emerald-500">{statsOutorgas.validas}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Válidas</p>
                                </div>
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?tab=outorgas&status=Vencendo')}>
                                    <p className="text-sm font-bold text-amber-500">{statsOutorgas.vencendo}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Vencendo</p>
                                </div>
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/licencas?tab=outorgas&status=Vencida')}>
                                    <p className="text-sm font-bold text-red-500">{statsOutorgas.vencidas}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Vencidas</p>
                                </div>
                            </div>
                        </div>

                        {/* Mensagem Motivacional */}
                        {(stats.compliance_rate < 100 || statsOutorgas.compliance < 100) ? (
                            <div className="text-center">
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 py-1.5 px-3 rounded-lg inline-block w-full">🚀 Rumo aos 100%!</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-1.5 px-3 rounded-lg inline-block w-full">🏆 100% Garantido!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(activeTab === 'Visão Geral' || activeTab === 'Atividade') && (
                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold">Pipeline de Processos</h3>
                        <a href="/processos" className="text-xs text-emerald-500 font-semibold hover:underline flex items-center gap-1">Ver Kanban <ArrowUpRight size={12} /></a>
                    </div>
                    <div className="flex items-center justify-between relative px-4">
                        <div className="absolute top-5 left-12 right-12 h-px bg-slate-200 dark:bg-white/[0.06]" />
                        <TimelineStep label="Planejamento" count={stages.planejamento} active={stages.planejamento > 0} />
                        <TimelineStep label="Coleta de Docs" count={stages.coleta} active={stages.coleta > 0} />
                        <TimelineStep label="Protocolado" count={stages.protocolado} active={stages.protocolado > 0} />
                        <TimelineStep label="Em Análise / Exigências" count={stages.exigencias} active={stages.exigencias > 0} />
                        <TimelineStep label="Concluído" count={stages.concluido} active={stages.concluido > 0} />
                    </div>
                </div>
            )}

            {(activeTab === 'Visão Geral' || activeTab === 'Vencimentos') && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 card">
                        <h3 className="font-bold mb-6">Licenças por Tipo</h3>
                        <div className="space-y-4">
                            {licencasPorTipo.slice(0, 5).map((item, i) => {
                                const pct = stats.total_licencas > 0 ? Math.round((item.count / stats.total_licencas) * 100) : 0
                                const color = getChartColor(item.tipo)
                                return (
                                    <div key={i} className="group cursor-pointer" onClick={() => navigate(`/licencas?tipo=${item.tipo}`)}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${color}`} />
                                                <span className="text-sm font-medium uppercase">{item.tipo}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500">{item.count}</span>
                                                <span className="text-[10px] text-slate-400">{pct}%</span>
                                            </div>
                                        </div>
                                        <MiniProgress value={pct} color={color} />
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-8 card overflow-hidden !p-0">
                        <div className="flex items-center justify-between p-6 pb-4">
                            <h3 className="font-bold">Vencimentos Próximos</h3>
                            <a href="/licencas" className="text-xs text-emerald-500 font-semibold hover:underline flex items-center gap-1">Ver todas <ArrowUpRight size={12} /></a>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="border-b border-slate-100 dark:border-white/[0.04]">
                                    <th className="table-header px-6">Cliente</th>
                                    <th className="table-header px-4">Tipo</th>
                                    <th className="table-header px-4">Órgão</th>
                                    <th className="table-header px-4">Vencimento</th>
                                    <th className="table-header px-6 text-right">Status</th>
                                </tr></thead>
                                <tbody className="text-sm">
                                    {recentExpiring.map((c, i) => {
                                        const status = computeStatus(c)
                                        const daysRemaining = status === 'Vencendo' ? getDaysRemaining(c) : null

                                        return (
                                            <tr key={i} className="table-row border-b border-slate-50 dark:border-white/[0.02] last:border-0 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-500/[0.03]" onClick={() => navigate(`/licencas?id=${c.id}`)}>
                                                <td className="py-3.5 px-6">
                                                    <p className="font-medium text-sm">{c.razao_social}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{c.atividade_licenciada || c.cidade}</p>
                                                </td>
                                                <td className="py-3.5 px-4"><span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-[10px] font-bold tracking-wider">{c.tipo}</span></td>
                                                <td className="py-3.5 px-4 text-slate-400 text-xs">{c.departamento || '—'}</td>
                                                <td className="py-3.5 px-4 text-xs font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{formatDate(c.validade)}</span>
                                                        {daysRemaining !== null && (
                                                            <span className="text-[10px] text-amber-500 font-semibold mt-0.5">({daysRemaining} dias)</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-6 text-right">
                                                    <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {recentExpiring.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400 text-sm">Nenhum vencimento próximo.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
