import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, X, Send, Loader2, Bot, User, MessageSquare } from 'lucide-react'
import { getFineResponse, initGemini } from '../../lib/gemini'
import { useAuth } from '../../contexts/AuthContext'
import { fetchDashboardStats, fetchProximosVencimentos, fetchFaturas } from '../../lib/api'

export default function FineChat() {
    const { profile } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [chat, setChat] = useState<{ role: 'user' | 'assistant', text: string }[]>([
        { role: 'assistant', text: 'Olá! Sou a Fine, sua assistente do EcoFin Manager. 💚 Como posso ajudar com seus vencimentos, faturas ou licenças hoje?' }
    ])
    const [loading, setLoading] = useState(false)
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

    const handleSend = async () => {
        if (!message.trim()) return

        const userMsg = message
        setMessage('')
        setChat(prev => [...prev, { role: 'user', text: userMsg }])
        setLoading(true)

        try {
            // Gather context data for training Fine on current state
            const [stats, vencimentos, faturas] = await Promise.all([
                fetchDashboardStats().catch(() => ({})),
                fetchProximosVencimentos(5).catch(() => []),
                fetchFaturas().then(f => f.slice(0, 5)).catch(() => [])
            ])

            const context = {
                stats,
                proximos_vencimentos: vencimentos.map(v => ({ tipo: v.tipo, cliente: v.razao_social, vencimento: v.validade })),
                faturas_recentes: faturas.map(f => ({ id: f.id, valor: f.valor_total, status: f.status }))
            }

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
            {/* Chat Toggle Button */}
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

            {/* Chat window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white dark:bg-[#0d1a14] rounded-3xl shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col overflow-hidden z-50 animate-slide-up">
                    {/* Header */}
                    <div className="p-4 bg-indigo-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">Fine</h3>
                                <p className="text-[10px] opacity-80">Assistente Inteligente</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-black/10">
                        {chat.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500'}`}>
                                        {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-indigo-500 text-white shadow-indigo-500/10' : 'bg-white dark:bg-[#1a2e25] border border-slate-100 dark:border-white/[0.04]'}`}>
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
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#0d1a14]">
                        <div className="flex gap-2">
                            <input
                                className="form-input flex-1 text-xs"
                                placeholder="Pergunte à Fine..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={handleSend}
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
