import { useState, useEffect } from 'react'
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        // Confere se o usuário já tem a sessão (vem do link do email)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                setError('Link de recuperação inválido ou expirado. Tente solicitar novamente no login.')
            }
        })
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.')
            return
        }

        setSubmitting(true)
        const { error: resetError } = await supabase.auth.updateUser({ password })

        if (resetError) {
            setError(resetError.message)
            setSubmitting(false)
            return
        }

        setSuccess('Senha redefinida com sucesso! Redirecionando...')
        setTimeout(() => {
            navigate('/', { replace: true })
        }, 2000)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1410] via-[#0d1a14] to-[#081210] p-4">
            <div className="w-full max-w-md">
                <div className="bg-[#0d1a14] border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-xl font-bold text-white text-center mb-1">
                        Nova Senha
                    </h2>
                    <p className="text-slate-400 text-sm text-center mb-6">
                        Insira sua nova senha abaixo.
                    </p>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40 rounded-2xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Nova senha"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
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
                            disabled={submitting || !!success || !!error?.includes('expirado')}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold rounded-2xl py-3.5 px-6 hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50"
                        >
                            {submitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>Atualizar Senha <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                        >
                            Voltar para o login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
