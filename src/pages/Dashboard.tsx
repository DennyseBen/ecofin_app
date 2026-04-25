import { Users, AlertTriangle, ShieldCheck, ArrowUpRight, Activity, TrendingUp, Leaf } from 'lucide-react'
import { useCallback } from 'react'
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

function Sparkbar({ value, color }: { value: number; color: string }) {
    return (
        <div style={{ width: '100%', height: 4, background: 'var(--neutral-bg)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 4, transition: 'width 1s ease' }} />
        </div>
    )
}

function KpiCard({ label, value, desc, icon: Icon, color, colorSoft, colorRing, path, delta }: {
    label: string; value: string | number; desc: string
    icon: React.ElementType; color: string; colorSoft: string; colorRing: string
    path: string; delta?: string
}) {
    const navigate = useNavigate()
    return (
        <div
            className="card-hover"
            onClick={() => navigate(path)}
            style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 0 }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: colorSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `inset 0 0 0 1px ${colorRing}`,
                }}>
                    <Icon size={17} style={{ color }} strokeWidth={2} />
                </div>
                <ArrowUpRight size={15} style={{ color: 'var(--text-dim)' }} />
            </div>
            <div style={{ color: 'var(--text-mute)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ color: 'var(--text-bright)', fontSize: 28, fontWeight: 700, letterSpacing: -0.8 }}>{value}</div>
                {delta && (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-fg)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TrendingUp size={11} strokeWidth={2.5} />
                        {delta}
                    </div>
                )}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>{desc}</div>
        </div>
    )
}

function TimelineStep({ label, count, active }: { label: string; count: number; active?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700,
                background: active ? 'var(--primary)' : 'var(--neutral-bg)',
                color: active ? 'var(--primary-ink)' : 'var(--text-dim)',
                boxShadow: active ? '0 0 0 4px var(--primary-soft)' : 'none',
                transition: 'all .2s',
            }}>
                {count}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 80, lineHeight: 1.3 }}>{label}</span>
        </div>
    )
}

export default function Dashboard() {
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

    const alertItems = alertasLicencas.filter(isInAlertZone).slice(0, 4)

    const stages = {
        planejamento: kanbanCards.filter(c => c.stage === 'planejamento').length,
        coleta: kanbanCards.filter(c => c.stage === 'coleta' || c.stage === 'preenchimento').length,
        protocolado: kanbanCards.filter(c => c.stage === 'protocolado').length,
        exigencias: kanbanCards.filter(c => c.stage === 'exigencias' || c.stage === 'analise').length,
        concluido: kanbanCards.filter(c => c.stage === 'concluido').length,
    }

    const outorgasValidas = outorgas.filter(o => computeStatus(o) === 'Válida').length
    const outorgasVencendo = outorgas.filter(o => computeStatus(o) === 'Vencendo').length
    const outorgasVencidas = outorgas.filter(o => computeStatus(o) === 'Vencida').length
    const outorgasAtivas = outorgasValidas + outorgasVencendo

    const getTypeColor = (tipo: string) => {
        const t = tipo.toUpperCase()
        if (t.includes('LO')) return 'var(--primary-bright)'
        if (t.includes('LI')) return 'var(--sky-fg)'
        if (t.includes('LP')) return 'var(--violet-fg)'
        if (t.includes('DLA')) return 'var(--amber-fg)'
        return 'var(--neutral-fg)'
    }

    if (statsLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
                <div className="animate-spin" style={{
                    width: 28, height: 28, borderRadius: 999,
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--primary-bright)',
                }} />
            </div>
        )
    }

    const kpis = [
        {
            label: 'Total de Clientes', value: stats.total_clientes, desc: 'Cadastrados no sistema',
            icon: Users, color: 'var(--primary-bright)',
            colorSoft: 'var(--primary-soft)', colorRing: 'var(--primary-ring)',
            path: '/clientes',
        },
        {
            label: 'Licenças Ativas', value: stats.licencas_validas, desc: 'De um total de ' + stats.total_licencas,
            icon: ShieldCheck, color: 'var(--sky-fg)',
            colorSoft: 'var(--sky-soft)', colorRing: 'var(--sky-ring)',
            path: '/licencas',
        },
        {
            label: 'Atenção Necessária', value: alertItems.length, desc: 'Licenças em alerta',
            icon: AlertTriangle, color: 'var(--amber-fg)',
            colorSoft: 'var(--amber-soft)', colorRing: 'var(--amber-ring)',
            path: '/notificacoes',
        },
    ]

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Welcome */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary-fg)', marginBottom: 4 }}>
                        <Leaf size={16} strokeWidth={2} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase' }}>EcoFin Manager</span>
                    </div>
                    <h2 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
                        Olá, {userName} 👋
                    </h2>
                    <p style={{ color: 'var(--text-mute)', fontSize: 13, marginTop: 4 }}>
                        Monitoramento de licenciamento ambiental em tempo real.
                    </p>
                </div>
                {alertItems.length > 0 && (
                    <div
                        onClick={() => navigate('/notificacoes')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                            background: 'var(--amber-soft)', border: '1px solid var(--amber-ring)',
                            borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                        }}
                    >
                        <AlertTriangle size={15} style={{ color: 'var(--amber-fg)' }} />
                        <span style={{ color: 'var(--amber-fg)', fontSize: 13, fontWeight: 600 }}>
                            {alertItems.length} licença{alertItems.length > 1 ? 's precisam' : ' precisa'} de atenção
                        </span>
                        <ArrowUpRight size={13} style={{ color: 'var(--amber-fg)' }} />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {kpis.map(k => <KpiCard key={k.label} {...k} />)}
            </div>

            {/* Conformidade */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={19} style={{ color: 'var(--primary-fg)' }} strokeWidth={2} />
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-bright)', fontSize: 14, fontWeight: 700 }}>Conformidade Licenças</div>
                            <div style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 2 }}>{stats.licencas_validas} válidas de {stats.total_licencas} total</div>
                        </div>
                        <div style={{ marginLeft: 'auto', color: 'var(--primary-fg)', fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{stats.compliance_rate}%</div>
                    </div>
                    <Sparkbar value={stats.compliance_rate} color="var(--primary-bright)" />
                    <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                        {[
                            { label: 'Válidas', val: stats.licencas_validas, color: 'var(--primary-fg)', status: 'Válida' },
                            { label: 'Vencendo', val: stats.vencendo_90_dias, color: 'var(--amber-fg)', status: 'Vencendo' },
                            { label: 'Vencidas', val: stats.licencas_vencidas, color: 'var(--rose-fg)', status: 'Vencida' },
                        ].map(s => (
                            <div
                                key={s.label}
                                onClick={() => navigate(`/licencas?status=${encodeURIComponent(s.status)}`)}
                                style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'var(--row-alt)', borderRadius: 8, cursor: 'pointer', transition: 'opacity .15s' }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                                <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.val}</div>
                                <div style={{ color: 'var(--text-dim)', fontSize: 10.5, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--sky-soft)', border: '1px solid var(--sky-ring)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Activity size={19} style={{ color: 'var(--sky-fg)' }} strokeWidth={2} />
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-bright)', fontSize: 14, fontWeight: 700 }}>Conformidade Outorgas</div>
                            <div style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 2 }}>{outorgasAtivas} ativas de {outorgas.length} total</div>
                        </div>
                        <div style={{ marginLeft: 'auto', color: 'var(--sky-fg)', fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
                            {outorgas.length > 0 ? Math.round((outorgasAtivas / outorgas.length) * 100) : 0}%
                        </div>
                    </div>
                    <Sparkbar value={outorgas.length > 0 ? Math.round((outorgasAtivas / outorgas.length) * 100) : 0} color="var(--sky-fg)" />
                    <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                        {[
                            { label: 'Válidas', val: outorgasValidas, color: 'var(--primary-fg)', status: 'Válida' },
                            { label: 'Vencendo', val: outorgasVencendo, color: 'var(--amber-fg)', status: 'Vencendo' },
                            { label: 'Vencidas', val: outorgasVencidas, color: 'var(--rose-fg)', status: 'Vencida' },
                        ].map(s => (
                            <div
                                key={s.label}
                                onClick={() => navigate(`/licencas?tab=outorgas&status=${encodeURIComponent(s.status)}`)}
                                style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'var(--row-alt)', borderRadius: 8, cursor: 'pointer', transition: 'opacity .15s' }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                                <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.val}</div>
                                <div style={{ color: 'var(--text-dim)', fontSize: 10.5, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main content: types + expiring */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>

                {/* License types */}
                <div className="card" style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <div style={{ color: 'var(--text-bright)', fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Licenças por Tipo</div>
                            <div style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 3 }}>Distribuição atual</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {licencasPorTipo.slice(0, 6).map((item, i) => {
                            const pct = stats.total_licencas > 0 ? Math.round((item.count / stats.total_licencas) * 100) : 0
                            const color = getTypeColor(item.tipo)
                            return (
                                <div key={i} onClick={() => navigate(`/licencas?tipo=${item.tipo}`)} style={{ cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 8, background: color, display: 'inline-block' }} />
                                            <span style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 500 }}>{item.tipo}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-bright)', fontSize: 12.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{item.count}</span>
                                            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{pct}%</span>
                                        </div>
                                    </div>
                                    <Sparkbar value={pct} color={color} />
                                </div>
                            )
                        })}
                        {licencasPorTipo.length === 0 && (
                            <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhum dado disponível.</div>
                        )}
                    </div>
                </div>

                {/* Expiring licenses */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        padding: '18px 22px 14px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
                    }}>
                        <div>
                            <div style={{ color: 'var(--text-bright)', fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Vencimentos Próximos</div>
                            <div style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 3 }}>Licenças com prazo próximo</div>
                        </div>
                        <button
                            onClick={() => navigate('/licencas')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontSize: 12, color: 'var(--primary-fg)', fontWeight: 600,
                                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            Ver todas <ArrowUpRight size={12} />
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {['Cliente', 'Tipo', 'Órgão', 'Vencimento', 'Status'].map((h, i) => (
                                        <th key={i} className="table-header" style={{ textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentExpiring.map((c, i) => {
                                    const status = computeStatus(c)
                                    const days = status === 'Vencendo' ? getDaysRemaining(c) : null
                                    return (
                                        <tr
                                            key={i}
                                            className="table-row"
                                            onClick={() => navigate(`/licencas?id=${c.id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td style={{ padding: '13px 16px' }}>
                                                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{c.razao_social}</div>
                                                <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>{c.atividade_licenciada || c.cidade}</div>
                                            </td>
                                            <td style={{ padding: '13px 16px' }}>
                                                <span style={{
                                                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700,
                                                    padding: '2px 8px', borderRadius: 6,
                                                    background: 'var(--neutral-bg)', color: 'var(--neutral-fg)',
                                                    border: '1px solid var(--border)',
                                                }}>{c.tipo}</span>
                                            </td>
                                            <td style={{ padding: '13px 16px', color: 'var(--text-mute)', fontSize: 12 }}>{c.departamento || '—'}</td>
                                            <td style={{ padding: '13px 16px' }}>
                                                <div style={{ color: 'var(--text)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatDate(c.validade)}</div>
                                                {days !== null && (
                                                    <div style={{ color: 'var(--amber-fg)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{days}d restantes</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                                                <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {recentExpiring.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Nenhum vencimento próximo.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Pipeline */}
            <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <div style={{ color: 'var(--text-bright)', fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Pipeline de Processos</div>
                        <div style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 3 }}>Distribuição por etapa</div>
                    </div>
                    <button
                        onClick={() => navigate('/processos')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary-fg)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        Ver Kanban <ArrowUpRight size={12} />
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 16px' }}>
                    <div style={{ position: 'absolute', top: 20, left: 48, right: 48, height: 1, background: 'var(--border)' }} />
                    <TimelineStep label="Planejamento" count={stages.planejamento} active={stages.planejamento > 0} />
                    <TimelineStep label="Coleta de Docs" count={stages.coleta} active={stages.coleta > 0} />
                    <TimelineStep label="Protocolado" count={stages.protocolado} active={stages.protocolado > 0} />
                    <TimelineStep label="Em Análise" count={stages.exigencias} active={stages.exigencias > 0} />
                    <TimelineStep label="Concluído" count={stages.concluido} active={stages.concluido > 0} />
                </div>
            </div>

        </div>
    )
}
