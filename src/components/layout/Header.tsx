import { Search, Bell, X, Calendar } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { fetchNotificacoes } from '../../lib/api'
import type { Licenca } from '../../lib/types'
import { useNavigate } from 'react-router-dom'

export default function Header() {
    const [showNotifs, setShowNotifs] = useState(false)
    const [notifs, setNotifs] = useState<Licenca[]>([])
    const [loadingN, setLoadingN] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()

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
        <header className="h-16 border-b border-slate-100 dark:border-white/[0.04] bg-white/60 dark:bg-[#0a1410]/60 flex items-center justify-between px-6 md:px-8 backdrop-blur-xl z-10">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-transparent focus:border-emerald-500/30 focus:bg-white dark:focus:bg-white/[0.05] rounded-2xl pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Pesquisar clientes, licenças ou processos..."
                        type="text"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2 relative" ref={ref}>
                <button
                    className="relative p-2.5 rounded-2xl text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
                    onClick={() => setShowNotifs(!showNotifs)}
                >
                    <Bell size={18} />
                    {notifs.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white dark:ring-[#0a1410]">
                            {notifs.length > 9 ? '9+' : notifs.length}
                        </span>
                    )}
                </button>

                {showNotifs && (
                    <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-[#0d1a14] border border-slate-100 dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/[0.06]">
                            <h3 className="font-bold text-sm">Notificações</h3>
                            <span className="text-[10px] text-slate-400">{notifs.length} alertas</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma notificação no momento.</div>
                            ) : (
                                notifs.map((n, i) => (
                                    <div
                                        key={i}
                                        className="p-3 border-b border-slate-50 dark:border-white/[0.03] hover:bg-emerald-50/50 dark:hover:bg-emerald-500/[0.03] cursor-pointer transition-colors"
                                        onClick={() => { navigate(`/licencas?id=${n.id}`); setShowNotifs(false) }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 mt-0.5">
                                                <Calendar size={12} className="text-amber-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate">{n.razao_social}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    <span className="font-semibold text-amber-500">Vence {formatDate(n.validade)}</span> · {n.tipo} · {n.departamento || '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {notifs.length > 0 && (
                            <div className="p-3 border-t border-slate-100 dark:border-white/[0.06] text-center">
                                <button className="text-xs text-emerald-500 font-semibold hover:underline" onClick={() => { navigate('/licencas'); setShowNotifs(false) }}>
                                    Ver todas as licenças →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    )
}
