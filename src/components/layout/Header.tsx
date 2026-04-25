import { Search, Bell, Plus, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { fetchNotificacoes } from '../../lib/api'
import type { Licenca } from '../../lib/types'
import { useNavigate, useLocation } from 'react-router-dom'

const PAGE_INFO: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'Dashboard', subtitle: 'Visão geral do sistema em tempo real' },
    '/clientes': { title: 'Clientes', subtitle: 'Gestão de clientes e empresas' },
    '/licencas': { title: 'Licenças', subtitle: 'Controle de licenças ambientais' },
    '/processos': { title: 'Processos', subtitle: 'Pipeline de processos ambientais' },
    '/financeiro': { title: 'Financeiro', subtitle: 'Gestão financeira e faturamento' },
    '/notificacoes': { title: 'Notificações', subtitle: 'Central de alertas e avisos' },
    '/relatorios': { title: 'Relatórios', subtitle: 'Análise e exportação de dados' },
    '/configuracoes': { title: 'Configurações', subtitle: 'Preferências e configurações do sistema' },
}

export default function Header() {
    const [showNotifs, setShowNotifs] = useState(false)
    const [notifs, setNotifs] = useState<Licenca[]>([])
    const ref = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const location = useLocation()

    const page = PAGE_INFO[location.pathname] ?? { title: 'EcoFin', subtitle: '' }

    useEffect(() => {
        fetchNotificacoes().then(setNotifs).catch(() => { })
    }, [])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setShowNotifs(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const formatDate = (d: string | null) => {
        if (!d) return '—'
        const [y, m, day] = d.split('T')[0].split('-')
        return `${day}/${m}/${y}`
    }

    return (
        <header className="header-bar" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--header-bg)',
            zIndex: 10, flexShrink: 0,
        }}>
            {/* Title area */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 11.5, fontWeight: 500, marginBottom: 3 }}>
                    <span>EcoFin</span>
                    <ChevronRight size={11} strokeWidth={2} style={{ color: 'var(--text-dim)' }} />
                    <span style={{ color: 'var(--text-mute)' }}>{page.title}</span>
                </div>
                <h1 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 22, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1 }}>
                    {page.title}
                </h1>
                {page.subtitle && (
                    <div style={{ color: 'var(--text-mute)', fontSize: 13, marginTop: 3 }}>{page.subtitle}</div>
                )}
            </div>

            {/* Search */}
            <div className="hidden md:flex" style={{
                alignItems: 'center', gap: 8, padding: '8px 12px', width: 280,
                background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 9,
                fontSize: 13, color: 'var(--text-dim)', cursor: 'text', flexShrink: 0,
            }}>
                <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <input
                    type="text"
                    placeholder="Buscar clientes, licenças…"
                    style={{
                        flex: 1, background: 'none', border: 'none', outline: 'none',
                        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                    }}
                />
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
                    padding: '1px 5px', background: 'var(--neutral-bg)', borderRadius: 4,
                    color: 'var(--text-dim)', border: '1px solid var(--border)', flexShrink: 0,
                }}>⌘K</span>
            </div>

            {/* Bell */}
            <div ref={ref} style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowNotifs(!showNotifs)}
                    style={{
                        position: 'relative', width: 36, height: 36, borderRadius: 9,
                        background: 'var(--input-bg)', border: '1px solid var(--border)',
                        color: 'var(--text-mute)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                    }}
                >
                    <Bell size={16} />
                    {notifs.length > 0 && (
                        <span style={{
                            position: 'absolute', top: 7, right: 8, width: 7, height: 7,
                            background: 'var(--rose)', borderRadius: 7,
                            boxShadow: '0 0 0 2px var(--surface)',
                        }} />
                    )}
                </button>

                {showNotifs && (
                    <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 12, boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5)',
                        zIndex: 50, overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 16px', borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{ color: 'var(--text-bright)', fontSize: 14, fontWeight: 700 }}>Notificações</div>
                            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{notifs.length} alerta{notifs.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {notifs.length === 0 ? (
                                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                                    Nenhuma notificação no momento.
                                </div>
                            ) : (
                                notifs.map((n, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { navigate(`/licencas?id=${n.id}`); setShowNotifs(false) }}
                                        style={{
                                            display: 'flex', gap: 12, padding: '12px 16px',
                                            borderBottom: '1px solid var(--divider)',
                                            cursor: 'pointer', transition: 'background .15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-soft)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: 'var(--amber-soft)', border: '1px solid var(--amber-ring)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Bell size={13} style={{ color: 'var(--amber-fg)' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {n.razao_social}
                                            </div>
                                            <div style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 2 }}>
                                                <span style={{ color: 'var(--amber-fg)', fontWeight: 600 }}>Vence {formatDate(n.validade)}</span>
                                                {' · '}{n.tipo}{n.departamento ? ` · ${n.departamento}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {notifs.length > 0 && (
                            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                                <button
                                    onClick={() => { navigate('/licencas'); setShowNotifs(false) }}
                                    style={{
                                        fontSize: 12, color: 'var(--primary-fg)', fontWeight: 600,
                                        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    Ver todas as licenças →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Nova Licença CTA */}
            <button
                className="hidden md:flex"
                onClick={() => navigate('/licencas')}
                style={{
                    alignItems: 'center', gap: 7, padding: '0 16px',
                    height: 36, flexShrink: 0,
                    background: `linear-gradient(180deg, var(--primary-bright), var(--primary))`,
                    color: 'var(--primary-ink)', border: 'none', borderRadius: 9,
                    fontSize: 13, fontWeight: 700, letterSpacing: -0.1, cursor: 'pointer',
                    boxShadow: '0 4px 14px -4px var(--primary), inset 0 1px 0 rgba(255,255,255,0.25)',
                    fontFamily: 'inherit',
                }}
            >
                <Plus size={14} strokeWidth={2.5} />
                Nova Licença
            </button>
        </header>
    )
}
