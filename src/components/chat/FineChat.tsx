import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, Bot, User } from 'lucide-react'
import { getFineResponse, initGemini } from '../../lib/gemini'
import { useAuth } from '../../contexts/AuthContext'
import { fetchDashboardStats, fetchProximosVencimentos, fetchFaturas, fetchAlertasLicencas, fetchKanbanCards } from '../../lib/api'

const QUICK_ACTIONS = [
    { label: '🔴 Alertas', msg: 'Quais licenças estão em alerta?' },
    { label: '📅 Vencimentos', msg: 'Mostre os próximos vencimentos' },
    { label: '💰 Faturas', msg: 'Como estão as faturas recentes?' },
    { label: '📊 Resumo', msg: 'Mostre o resumo do dashboard' },
    { label: '📋 Kanban', msg: 'Como está o Kanban de processos?' },
]

export default function FineChat() {
    const { profile } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [chat, setChat] = useState<{ role: 'user' | 'assistant', text: string }[]>([
        { role: 'assistant', text: 'Olá! Sou a Fine, sua assistente do EcoFin Manager. 💚\nCarregando dados do sistema...' }
    ])
    const [loading, setLoading] = useState(false)
    const [proactiveLoaded, setProactiveLoaded] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const apiKey = profile?.gemini_api_key || import.meta.env.VITE_GEMINI_API_KEY
        initGemini(apiKey)
    }, [profile?.gemini_api_key])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [chat])

    // Proactive greeting when chat opens for the first time
    useEffect(() => {
        if (!isOpen || proactiveLoaded) return
        setProactiveLoaded(true)

        const load = async () => {
            try {
                const [stats, vencimentos, alertas, kanban] = await Promise.all([
                    fetchDashboardStats().catch(() => null),
                    fetchProximosVencimentos(5).catch(() => []),
                    fetchAlertasLicencas().catch(() => []),
                    fetchKanbanCards().catch(() => []),
                ])

                const criticos = alertas.filter((l: any) => {
                    if (!l.validade) return false
                    const dias = Math.ceil((new Date(l.validade).getTime() - Date.now()) / 86400000)
                    return dias <= 60
                }).length

                let greeting = 'Olá! Sou a Fine 💚 Aqui está o resumo rápido:\n\n'
                if (stats) {
                    greeting += `📊 **${stats.total_licencas ?? 0}** licenças | **${stats.total_clientes ?? 0}** clientes\n`
                    greeting += `✅ Compliance: **${Number(stats.compliance_rate ?? 0).toFixed(1)}%**\n\n`
                }
                if (criticos > 0) {
                    greeting += `🔴 **${criticos}** licença(s) vencendo em até 60 dias! Digite "alertas" para ver.\n`
                } else if (vencimentos.length > 0) {
                    greeting += `🟡 **${vencimentos.length}** vencimento(s) nos próximos meses.\n`
                } else {
                    greeting += `🟢 Nenhuma licença em alerta crítico!\n`
                }
                greeting += '\nComo posso ajudar?'

                setChat([{ role: 'assistant', text: greeting }])
            } catch {
                setChat([{ role: 'assistant', text: 'Olá! Sou a Fine 💚 Como posso ajudar com seus vencimentos, faturas ou licenças?' }])
            }
        }
        load()
    }, [isOpen, proactiveLoaded])

    const buildContext = useCallback(async () => {
        const [stats, vencimentos, faturas, alertas, kanban] = await Promise.all([
            fetchDashboardStats().catch(() => ({})),
            fetchProximosVencimentos(8).catch(() => []),
            fetchFaturas().then(f => f.slice(0, 5)).catch(() => []),
            fetchAlertasLicencas().catch(() => []),
            fetchKanbanCards().catch(() => []),
        ])
        return {
            stats,
            proximos_vencimentos: vencimentos.map((v: any) => ({ tipo: v.tipo, cliente: v.razao_social, vencimento: v.validade })),
            faturas_recentes: faturas.map((f: any) => ({ id: f.id, valor: f.valor_total, status: f.status })),
            alertas: alertas.slice(0, 10).map((l: any) => ({ tipo: l.tipo, cliente: l.razao_social, vencimento: l.validade })),
            alertas_criticos: alertas.filter((l: any) => {
                if (!l.validade) return false
                return Math.ceil((new Date(l.validade).getTime() - Date.now()) / 86400000) <= 60
            }).length,
            kanban: kanban.map((c: any) => ({ fase: c.fase, titulo: c.titulo })),
        }
    }, [])

    const handleSend = async (text?: string) => {
        const userMsg = text || message
        if (!userMsg.trim()) return

        setMessage('')
        setChat(prev => [...prev, { role: 'user', text: userMsg }])
        setLoading(true)

        try {
            const context = await buildContext()
            const response = await getFineResponse(userMsg, context)
            setChat(prev => [...prev, { role: 'assistant', text: response }])
        } catch (e: any) {
            setChat(prev => [...prev, { role: 'assistant', text: `Erro: ${e.message || 'Verifique sua chave nas configurações.'}` }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-center transition-all hover:scale-110 z-40 group"
                >
                    <Sparkles className="group-hover:animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-96 h-[560px] bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col overflow-hidden z-50 animate-slide-up">
                    {/* Header */}
                    <div className="p-4 bg-indigo-500 text-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">Fine</h3>
                                <p className="text-[10px] opacity-80">Assistente Inteligente · EcoFin</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-black/10 min-h-0">
                        {chat.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500'}`}>
                                        {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-indigo-500 text-white shadow-indigo-500/10' : 'bg-white dark:bg-[#1a2e25] border border-slate-100 dark:border-white/[0.04] text-slate-700 dark:text-slate-200'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="flex gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                        <Loader2 size={12} className="animate-spin" />
                                    </div>
                                    <div className="p-3 bg-white dark:bg-[#1a2e25] border border-slate-100 dark:border-white/[0.04] rounded-2xl">
                                        <div className="flex gap-1 items-center">
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-black/20 scrollbar-none">
                        {QUICK_ACTIONS.map(qa => (
                            <button
                                key={qa.label}
                                onClick={() => handleSend(qa.msg)}
                                disabled={loading}
                                className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                {qa.label}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#0f172a] shrink-0">
                        <div className="flex gap-2">
                            <input
                                className="form-input flex-1 text-xs"
                                placeholder="Pergunte à Fine..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !loading && handleSend()}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!message.trim() || loading}
                                className="p-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
