import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
    LayoutDashboard, Users, FileText, Wallet, ClipboardList,
    Settings, Bell, BarChart3, Menu, X, LogOut, Leaf,
    MoreHorizontal, Shield
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchAlertCount } from '../../lib/api'

const themeOptions = [
    { id: 'moderno', label: 'Dark' },
    { id: 'contemporaneo', label: 'Claro' },
    { id: 'galaxy', label: 'Nature' },
] as const

export default function Sidebar() {
    const { theme, setTheme } = useTheme()
    const { user, isAdmin, signOut } = useAuth()
    const location = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [alertCount, setAlertCount] = useState(0)

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'
    const userEmail = user?.email || ''
    const userRole = user?.user_metadata?.role || (isAdmin ? 'Administrador' : 'Analista Ambiental')
    const userAvatar = user?.user_metadata?.avatar_url
    const userInitials = userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

    useEffect(() => {
        fetchAlertCount()
            .then(setAlertCount)
            .catch(() => setAlertCount(0))
    }, [])

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clientes', icon: Users, label: 'Clientes' },
        { to: '/licencas', icon: Shield, label: 'Licenças' },
        { to: '/processos', icon: ClipboardList, label: 'Processos' },
        { to: '/financeiro', icon: Wallet, label: 'Financeiro' },
        { to: '/notificacoes', icon: Bell, label: 'Notificações', badge: alertCount > 0 ? alertCount : undefined },
        { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
        { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    ]

    const isActive = (to: string) => location.pathname === to

    return (
        <>
            {/* Mobile toggle */}
            <button
                className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl shadow-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--primary-bright)' }}
                onClick={() => setMobileOpen(true)}
            >
                <Menu size={20} />
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
                className={`
                    fixed md:static inset-y-0 left-0 z-50
                    w-[240px] flex-shrink-0 flex flex-col
                    transition-transform duration-300
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                {/* Logo */}
                <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                            src="/logo.png"
                            alt="EcoFin"
                            style={{
                                width: 34, height: 34, borderRadius: 9,
                                objectFit: 'contain', flexShrink: 0,
                            }}
                        />
                        <div>
                            <div style={{ color: 'var(--text-bright)', fontWeight: 700, fontSize: 16, letterSpacing: -0.3, lineHeight: 1 }}>EcoFin</div>
                            <div style={{ color: 'var(--text-dim)', fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 3, fontWeight: 500 }}>Manager</div>
                        </div>
                    </div>
                    <button className="md:hidden" style={{ color: 'var(--text-mute)' }} onClick={() => setMobileOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                {/* Section label */}
                <div style={{ padding: '12px 24px 8px', color: 'var(--text-dim)', fontSize: 10.5, fontWeight: 600, letterSpacing: 1.3, textTransform: 'uppercase' }}>
                    Menu
                </div>

                {/* Navigation */}
                <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    {navItems.map(({ to, icon: Icon, label, badge }) => {
                        const active = isActive(to)
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                onClick={() => setMobileOpen(false)}
                                className={active ? 'sidebar-link-active' : 'sidebar-link'}
                            >
                                <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                                <span style={{ flex: 1 }}>{label}</span>
                                {badge !== undefined && (
                                    <span style={{
                                        fontSize: 10.5, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                                        background: active ? 'var(--primary-soft)' : 'var(--rose-soft)',
                                        color: active ? 'var(--primary-fg)' : 'var(--rose-fg)',
                                        minWidth: 22, textAlign: 'center',
                                    }}>
                                        {badge > 9 ? '9+' : badge}
                                    </span>
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div style={{ padding: 16 }}>
                    {/* PRO plan widget */}
                    <div style={{
                        padding: 14, borderRadius: 10, marginBottom: 12,
                        background: 'var(--primary-soft)',
                        border: '1px solid var(--primary-ring)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Leaf size={13} style={{ color: 'var(--primary-fg)' }} />
                            <div style={{ color: 'var(--primary-fg)', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3 }}>PLANO PRO</div>
                        </div>
                        <div style={{ color: 'var(--text-mute)', fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
                            Licenciamento ambiental completo
                        </div>
                        <div style={{ height: 4, background: 'var(--neutral-bg)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '86%', background: 'var(--primary-bright)', borderRadius: 4 }} />
                        </div>
                    </div>

                    {/* Theme selector */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4,
                        padding: 4, borderRadius: 8,
                        background: 'var(--input-bg)', border: '1px solid var(--border)',
                        marginBottom: 10,
                    }}>
                        {themeOptions.map(opt => {
                            const active = theme === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => setTheme(opt.id)}
                                    style={{
                                        borderRadius: 6, padding: '5px 4px',
                                        fontSize: 10.5, fontWeight: 600,
                                        cursor: 'pointer', border: 'none',
                                        background: active ? 'var(--primary)' : 'transparent',
                                        color: active ? 'var(--primary-ink)' : 'var(--text-mute)',
                                        transition: 'background .15s, color .15s',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* User card */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 8, borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                    }}>
                        {userAvatar ? (
                            <img src={userAvatar} alt={userName} referrerPolicy="no-referrer"
                                style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                            <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: 'var(--avatar-bg)', color: 'var(--avatar-fg)',
                                fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                            }}>
                                {userInitials}
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {userName}
                            </div>
                            <div style={{ color: 'var(--text-dim)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {userRole}
                            </div>
                        </div>
                        <button
                            onClick={signOut}
                            title="Sair"
                            style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rose-fg)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                            Xlmart Stack · v1.2.0
                        </p>
                    </div>
                </div>
            </aside>
        </>
    )
}
