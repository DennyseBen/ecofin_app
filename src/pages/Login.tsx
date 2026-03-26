import { useState } from 'react'
import { Leaf, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function Login() {
    const { user, loading, signIn, signUp } = useAuth()
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState('')

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a1410]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        )
    }

    if (user) return <Navigate to="/" replace />

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSubmitting(true)

        if (isSignUp) {
            if (!name.trim()) { setError('Informe seu nome'); setSubmitting(false); return }
            if (password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); setSubmitting(false); return }
            const { error: err } = await signUp(email, password, name)
            if (err) { setError(err); setSubmitting(false); return }
            setSuccess('Conta criada! Verifique seu email para confirmar.')
        } else {
            const { error: err } = await signIn(email, password)
            if (err) { setError('Email ou senha incorretos'); setSubmitting(false); return }
        }
        setSubmitting(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1410] via-[#0d1a14] to-[#081210] p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                        <img src="/logo.png" alt="EcoFin Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">EcoFin Manager</h1>
                    <p className="text-slate-400 text-sm mt-2">Gestão de licenciamento ambiental</p>
                </div>

                <div className="bg-[#0d1a14] border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-xl font-bold text-white text-center mb-1">
                        {isSignUp ? 'Criar Conta' : 'Bem-vindo'}
                    </h2>
                    <p className="text-slate-400 text-sm text-center mb-6">
                        {isSignUp ? 'Preencha para se cadastrar' : 'Faça login para acessar o sistema'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div className="relative">
                                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    placeholder="Seu nome"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="email"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="password"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Senha"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold rounded-2xl py-3.5 px-6 hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50"
                        >
                            {submitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>{isSignUp ? 'Criar Conta' : 'Entrar'} <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
                            className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                        >
                            {isSignUp ? 'Já tem conta? Entrar' : 'Criar nova conta'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-600 mt-6">Criado por Dennys Silva | Xlmart Stack | Versão 1.1.0 - 07/03/26</p>
            </div>
        </div>
    )
}
