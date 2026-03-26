import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
    LayoutDashboard, Users, FileText, Wallet, ClipboardList,
    Settings, Moon, Sun, Bell,
    Menu, X, LogOut, ShieldCheck
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchAlertCount } from '../../lib/api'

export default function Sidebar() {
    const { theme, toggleTheme } = useTheme()
    const { user, isAdmin, signOut } = useAuth()
    const location = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [alertCount, setAlertCount] = useState(0)

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'
    const userEmail = user?.email || ''
    const userInitial = userName.charAt(0).toUpperCase()
    const userAvatar = user?.user_metadata?.avatar_url

    useEffect(() => {
        fetchAlertCount()
            .then(setAlertCount)
            .catch(() => setAlertCount(0))
    }, [])

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clientes', icon: Users, label: 'Clientes' },
        { to: '/licencas', icon: FileText, label: 'Licenças' },
        { to: '/notificacoes', icon: Bell, label: 'Notificações', badge: alertCount > 0 ? alertCount : undefined },
        { to: '/financeiro', icon: Wallet, label: 'Finanças' },
        { to: '/processos', icon: ClipboardList, label: 'Processos' },
        { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    ]

    return (
        <>
            {/* Mobile toggle */}
            <button
                className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-2xl bg-white/90 dark:bg-white/10 backdrop-blur-lg shadow-lg text-emerald-500"
                onClick={() => setMobileOpen(true)}
            >
                <Menu size={22} />
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed md:static inset-y-0 left-0 z-50
          w-[260px] flex-shrink-0 flex flex-col
          bg-white/80 dark:bg-[#0d1a14]/90 backdrop-blur-xl
          border-r border-slate-100 dark:border-white/[0.05]
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
            >
                {/* Logo */}
                <div className="p-6 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            <img src="/logo.png" alt="EcoFin Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold tracking-tight">EcoFin</h2>
                            <p className="text-[10px] text-slate-400 -mt-0.5 tracking-wider">MANAGER</p>
                        </div>
                    </div>
                    <button className="md:hidden text-slate-400 hover:text-slate-600" onClick={() => setMobileOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                {/* Nav label */}
                <div className="px-7 mt-2 mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600">Menu Principal</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-0.5">
                    {navItems.map(({ to, icon: Icon, label, badge }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={() => setMobileOpen(false)}
                            className={
                                location.pathname === to
                                    ? 'sidebar-link-active'
                                    : 'sidebar-link'
                            }
                        >
                            <div className="relative">
                                <Icon size={18} />
                                {badge !== undefined && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                        {badge > 9 ? '9+' : badge}
                                    </span>
                                )}
                            </div>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 space-y-2">
                    <button onClick={toggleTheme} className="sidebar-link w-full">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                    </button>
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
                        {userAvatar ? (
                            <img src={userAvatar} alt={userName} className="w-9 h-9 rounded-xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                {userInitial}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <p className="text-sm font-semibold truncate">{userName}</p>
                                {isAdmin && <ShieldCheck size={12} className="text-emerald-500 shrink-0" title="Administrador" />}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
                        </div>
                        <button onClick={signOut} className="text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors" title="Sair">
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
                {/* Version Info */}
                <div className="px-4 pb-6 text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                        Criado por Dennys Silva<br />
                        Xlmart Stack | Versão 1.2.0 - 16/03/26
                    </p>
                </div>
            </aside>
        </>
    )
}
