import { Users, AlertTriangle, ShieldCheck, ArrowUpRight, Leaf, Activity, Bell, Droplets, Target, Medal } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext'
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

function ComplianceMetric({ title, stats, type, onClickParam }: { title: string, stats: any, type: 'licencas' | 'outorgas', onClickParam: string }) {
    const is100 = stats.compliance === 100
    const colorClass = stats.compliance >= 70 ? 'text-emerald-500' : stats.compliance >= 40 ? 'text-amber-500' : 'text-red-500'
    const barColorClass = stats.compliance >= 70 ? 'stroke-emerald-500' : stats.compliance >= 40 ? 'stroke-amber-500' : 'stroke-red-500'
    const Icon = type === 'licencas' ? Leaf : Droplets
    const iconColor = type === 'licencas' ? 'text-emerald-500' : 'text-sky-500'
    const iconBg = type === 'licencas' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-sky-50 dark:bg-sky-500/10'

    const { theme } = useTheme()

    let chartUI = null;

    if (theme === 'contemporaneo') {
        const pieColor = stats.compliance >= 70 ? '#10b981' : stats.compliance >= 40 ? '#f59e0b' : '#ef4444'
        const pieBgColor = stats.compliance >= 70 ? '#10b98120' : stats.compliance >= 40 ? '#f59e0b20' : '#ef444420'
        chartUI = (
            <div className="relative flex items-center justify-center w-[84px] h-[84px] shrink-0 rounded-full" style={{ background: `conic-gradient(${pieColor} ${stats.compliance}%, ${pieBgColor} ${stats.compliance}%)` }}>
                 <div className="w-[60px] h-[60px] bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-inner">
                     <span className={`text-xl font-black ${colorClass}`}>{stats.compliance}%</span>
                 </div>
            </div>
        )
    } else if (theme === 'moderno') {
        chartUI = (
             <div className="relative flex flex-col items-center justify-end w-[90px] h-[50px] shrink-0 overflow-visible mt-2">
                 <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                      <path d="M 10 50 A 40 40 0 0 1 90 50" className="stroke-slate-200 dark:stroke-white/[0.08] fill-none" strokeWidth="12" strokeLinecap="round" />
                      <path d="M 10 50 A 40 40 0 0 1 90 50" className={`fill-none ${barColorClass} transition-all duration-1000 ease-out`} strokeWidth="12" strokeDasharray="125.6" strokeDashoffset={125.6 - (stats.compliance / 100) * 125.6} strokeLinecap="round" />
                 </svg>
                 <span className={`absolute bottom-0 translate-y-3 text-2xl font-black ${colorClass}`}>{stats.compliance}%</span>
             </div>
        )
    } else {
        // Galaxy
        const glowColor = stats.compliance >= 70 ? 'rgba(16,185,129,0.5)' : stats.compliance >= 40 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'
        chartUI = (
            <div className="relative flex items-center justify-center w-[84px] h-[84px] shrink-0" style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}>
                <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" className="stroke-white/[0.02] fill-none" strokeWidth="8" />
                    <circle 
                        cx="50" cy="50" r="40" 
                        className={`fill-none ${barColorClass} transition-all duration-1000 ease-out`} 
                        strokeWidth="8" 
                        strokeDasharray="251.3" 
                        strokeDashoffset={251.3 - (stats.compliance / 100) * 251.3} 
                        strokeLinecap="round" 
                    />
                </svg>
            </div>
        )
    }

    return (
        <div className="card p-6 flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-white/20">
            {is100 && (
                <div className="absolute -top-4 -right-4 opacity-5 text-emerald-500 pointer-events-none">
                    <ShieldCheck size={140} />
                </div>
            )}
            <div className="relative z-10 w-full flex flex-col h-full justify-between">
                
                <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-xl ${iconBg}`}>
                                <Icon size={18} className={iconColor} />
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">
                                {title}
                            </h3>
                        </div>
                        {theme !== 'moderno' && theme !== 'contemporaneo' && (
                            <div className="flex items-baseline gap-1">
                                <span className={`text-5xl font-black tracking-tight leading-none ${colorClass}`}>{stats.compliance}%</span>
                            </div>
                        )}
                        <span className={`text-[10px] uppercase tracking-widest font-bold text-slate-400 ${theme === 'moderno' || theme === 'contemporaneo' ? 'mt-0' : 'mt-2'}`}>Conformidade</span>
                    </div>

                    {chartUI}
                </div>

                <div className="flex items-center mt-3 bg-slate-50 dark:bg-white/[0.02] p-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                    <a href={`/licencas?${onClickParam}status=Válida`} className="flex flex-col items-start flex-1 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-white/5 transition-all cursor-pointer border-r border-transparent">
                        <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-500 tracking-wider mb-1">Válidas</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{stats.validas}</span>
                    </a>

                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700/50 mx-1" />

                    <a href={`/licencas?${onClickParam}status=Vencendo`} className="flex flex-col items-start flex-1 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-white/5 transition-all cursor-pointer">
                        <span className="text-[9px] uppercase font-bold text-amber-500 tracking-wider mb-1">Vencendo</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{stats.vencendo}</span>
                    </a>

                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700/50 mx-1" />

                    <a href={`/licencas?${onClickParam}status=Vencida`} className="flex flex-col items-start flex-1 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-white/5 transition-all cursor-pointer">
                        <span className="text-[9px] uppercase font-bold text-red-500 tracking-wider mb-1">Vencidas</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-white leading-none">{stats.vencidas}</span>
                    </a>
                </div>
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
        { label: 'Atenção Necessária', value: alertItems.length, icon: AlertTriangle, desc: 'Alertas pendentes', iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconColor: 'text-amber-500', path: '/notificacoes' },
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
                    <h1 className="text-3xl font-extrabold tracking-tight">Olá, {userName}</h1>
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
                    {/* Paineis de Conformidade Individuais (AGORA NA ESQUERDA) */}
                    <div className="lg:col-span-5 flex flex-col gap-5">
                        <ComplianceMetric
                            title="Conformidade Licenças"
                            type="licencas"
                            stats={{ compliance: stats.compliance_rate, validas: stats.licencas_validas, vencendo: stats.vencendo_90_dias, vencidas: stats.licencas_vencidas }}
                            onClickParam=""
                        />
                        <ComplianceMetric
                            title="Conformidade Outorgas"
                            type="outorgas"
                            stats={{ compliance: statsOutorgas.compliance, validas: statsOutorgas.validas, vencendo: statsOutorgas.vencendo, vencidas: statsOutorgas.vencidas }}
                            onClickParam="tab=outorgas&"
                        />

                        {/* Mensagem Motivacional */}
                        {(stats.compliance_rate < 100 || statsOutorgas.compliance < 100) ? (
                            <div className="text-center mt-1">
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 py-3 px-4 rounded-xl flex items-center justify-center gap-2 w-full border border-amber-100 dark:border-amber-500/20 shadow-sm">
                                    <Target size={14} /> Rumo aos 100% de conformidade
                                </span>
                            </div>
                        ) : (
                            <div className="text-center mt-1">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-3 px-4 rounded-xl flex items-center justify-center gap-2 w-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                                    <Medal size={14} /> 100% Garantido. Trabalho excelente.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* KPIs principais (AGORA NA DIREITA) */}
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="card-hover cursor-pointer animate-slide-up flex flex-col justify-between" style={{ animationDelay: `${i * 80}ms` }} onClick={() => navigate(kpi.path)}>
                                <div className="flex items-start justify-between">
                                    <div className={`p-3 rounded-2xl ${kpi.iconBg}`}><kpi.icon size={22} className={kpi.iconColor} /></div>
                                    <ArrowUpRight size={18} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <div className="mt-6">
                                    <p className="text-4xl font-black">{kpi.value}</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-2">{kpi.label}</p>
                                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mt-1">{kpi.desc}</p>
                                </div>
                            </div>
                        ))}
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
