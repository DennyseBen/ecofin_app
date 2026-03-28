import { Moon, Sun, User as UserIcon, Bell, CheckCircle2, FileText, Shield, Users, Mail, Phone, MessageSquare, Plus, Trash2, Loader2, ShieldCheck, X, Sparkles } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { fetchConfigNfse, saveConfigNfse, fetchAllProfiles, updateUserRole, inviteUser, fetchInvites, deleteInvite } from '../lib/api'
import type { ConfigNfse, UserProfile, UserInvite } from '../lib/types'

export default function Configuracoes() {
    const { theme, toggleTheme } = useTheme()
    const { user, profile, isAdmin, updateProfile, updateNotificationSettings, updatePhone, refreshProfile } = useAuth()
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [saving, setSaving] = useState(false)
    const [savingPhone, setSavingPhone] = useState(false)
    const [toast, setToast] = useState<{ message: string; visible: boolean; error?: boolean }>({ message: '', visible: false })

    // Notification state
    const [notifEmail, setNotifEmail] = useState('')
    const [notifWhatsApp, setNotifWhatsApp] = useState('')
    const [notifVencimentos, setNotifVencimentos] = useState(true)
    const [notifRenovacoes, setNotifRenovacoes] = useState(true)
    const [notifSistema, setNotifSistema] = useState(true)
    const [savingNotif, setSavingNotif] = useState(false)

    // NFS-e config state
    const [nfse, setNfse] = useState<Partial<ConfigNfse>>({
        cnpj_prestador: '',
        inscricao_mun: '',
        razao_social: '',
        municipio_ibge: '1504208',
        uf: 'PA',
        codigo_servico: '7.02',
        aliquota_iss: 3.00,
        discriminacao_padrao: 'Assessoria Ambiental e Licenciamento - Referente à competência {competencia}',
    })
    const [loadingNfse, setLoadingNfse] = useState(true)
    const [savingNfse, setSavingNfse] = useState(false)

    // Admin panel state
    const [profiles, setProfiles] = useState<UserProfile[]>([])
    const [invites, setInvites] = useState<UserInvite[]>([])
    const [loadingAdmin, setLoadingAdmin] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteName, setInviteName] = useState('')
    const [sendingInvite, setSendingInvite] = useState(false)

    useEffect(() => {
        fetchConfigNfse().then(cfg => {
            if (cfg) setNfse(cfg)
            setLoadingNfse(false)
        })
    }, [])

    useEffect(() => {
        if (user?.user_metadata?.full_name) setName(user.user_metadata.full_name)
    }, [user])

    useEffect(() => {
        if (profile) {
            setPhone(profile.phone || '')
            setNotifEmail(profile.email_notificacoes || user?.email || '')
            setNotifWhatsApp(profile.whatsapp_notificacoes || '')
            setNotifVencimentos(profile.notify_vencimentos ?? true)
            setNotifRenovacoes(profile.notify_renovacoes ?? true)
            setNotifSistema(profile.notify_sistema ?? true)
        }
    }, [profile])

    useEffect(() => {
        if (isAdmin) {
            setLoadingAdmin(true)
            Promise.all([fetchAllProfiles(), fetchInvites()])
                .then(([p, i]) => { setProfiles(p); setInvites(i) })
                .catch(() => { })
                .finally(() => setLoadingAdmin(false))
        }
    }, [isAdmin])

    const handleSaveNfse = async () => {
        setSavingNfse(true)
        try {
            await saveConfigNfse(nfse)
            showToast('Configuração NFS-e salva com sucesso!')
        } catch {
            showToast('Erro ao salvar configuração NFS-e', true)
        } finally {
            setSavingNfse(false)
        }
    }

    const setNfseField = (field: keyof ConfigNfse, value: string | number) =>
        setNfse(prev => ({ ...prev, [field]: value }))

    const handleSaveProfile = async () => {
        if (!name.trim()) return
        setSaving(true)
        const { error } = await updateProfile(name)
        setSaving(false)
        if (!error) showToast('Perfil atualizado com sucesso!')
        else showToast('Erro ao atualizar perfil', true)
    }

    const handleSavePhone = async () => {
        if (!phone.trim()) return
        setSavingPhone(true)
        const { error, becameAdmin } = await updatePhone(phone)
        setSavingPhone(false)
        if (!error) {
            if (becameAdmin) showToast('Telefone salvo! Nível administrativo concedido.')
            else showToast('Telefone salvo com sucesso!')
            refreshProfile()
        } else {
            showToast('Erro ao salvar telefone', true)
        }
    }

    const handleSaveNotif = async () => {
        setSavingNotif(true)
        const { error } = await updateNotificationSettings({
            email_notificacoes: notifEmail || null,
            whatsapp_notificacoes: notifWhatsApp || null,
            notify_vencimentos: notifVencimentos,
            notify_renovacoes: notifRenovacoes,
            notify_sistema: notifSistema
        })
        setSavingNotif(false)
        if (!error) showToast('Preferências de notificação salvas!')
        else showToast('Erro ao salvar preferências', true)
    }

    const handleToggleRole = async (userId: string, currentRole: 'user' | 'admin') => {
        if (userId === user?.id) { showToast('Não é possível alterar o próprio papel.', true); return }
        const newRole = currentRole === 'admin' ? 'user' : 'admin'
        await updateUserRole(userId, newRole)
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
        showToast(`Papel atualizado para ${newRole === 'admin' ? 'Administrador' : 'Usuário'}`)
    }

    const handleSendInvite = async () => {
        if (!inviteEmail.trim() || !user) return
        setSendingInvite(true)
        try {
            await inviteUser(inviteEmail, inviteName, user.id)
            showToast(`Convite enviado para ${inviteEmail}!`)
            setInviteEmail('')
            setInviteName('')
            const updated = await fetchInvites()
            setInvites(updated)
        } catch (e: any) {
            showToast(e.message || 'Erro ao enviar convite', true)
        } finally {
            setSendingInvite(false)
        }
    }

    const handleDeleteInvite = async (id: number) => {
        await deleteInvite(id)
        setInvites(prev => prev.filter(i => i.id !== id))
    }

    const showToast = (message: string, error = false) => {
        setToast({ message, visible: true, error })
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
    }

    const formatPhoneDisplay = (v: string) => {
        const d = v.replace(/\D/g, '').slice(0, 11)
        if (d.length <= 2) return d
        if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
        if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-3xl relative">

            {/* Toast Notification */}
            {toast.visible && (
                <div className={`fixed bottom-6 right-6 ${toast.error ? 'bg-red-500 shadow-red-500/20' : 'bg-emerald-500 shadow-emerald-500/20'} text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-slide-up z-50`}>
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-semibold">{toast.message}</span>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Configurações</h1>
                <p className="text-slate-400 text-sm">Gerencie suas preferências e conta.</p>
            </div>

            {/* Admin badge */}
            {isAdmin && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <ShieldCheck size={20} className="text-emerald-500" />
                    <div>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Conta Administrador</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60">Você tem acesso ao painel administrativo e pode gerenciar usuários.</p>
                    </div>
                </div>
            )}

            {/* Aparência */}
            <section className="card">
                <div className="flex items-center gap-3 mb-6">
                    {theme === 'dark' ? <Moon size={18} className="text-emerald-500" /> : <Sun size={18} className="text-emerald-500" />}
                    <h3 className="font-bold">Aparência</h3>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Tema Escuro</p>
                        <p className="text-xs text-slate-400">Alterne entre modo claro e escuro</p>
                    </div>
                    <button onClick={toggleTheme} className="relative w-12 h-7 rounded-full bg-slate-200 dark:bg-emerald-500 transition-colors">
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </section>

            {/* Perfil */}
            <section className="card">
                <div className="flex items-center gap-3 mb-6">
                    <UserIcon size={18} className="text-emerald-500" />
                    <h3 className="font-bold">Perfil</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block">Nome</label>
                        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block">E-mail</label>
                        <input className="form-input opacity-60 cursor-not-allowed" value={user?.email || ''} disabled />
                    </div>
                </div>
                <button className="btn-primary mt-4 disabled:opacity-50" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </section>

            {/* Telefone / Nível de Acesso */}
            <section className="card">
                <div className="flex items-center gap-3 mb-2">
                    <Phone size={18} className="text-emerald-500" />
                    <h3 className="font-bold">Telefone</h3>
                    {isAdmin && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Admin Master</span>}
                </div>
                <p className="text-xs text-slate-400 mb-4">
                    Informe seu número de celular. Números autorizados como administradores recebem acesso ao painel de gestão de usuários.
                </p>
                <div className="flex gap-3">
                    <input
                        className="form-input flex-1"
                        placeholder="(94) 99999-9999"
                        value={formatPhoneDisplay(phone)}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        maxLength={16}
                    />
                    <button className="btn-primary disabled:opacity-50" onClick={handleSavePhone} disabled={savingPhone}>
                        {savingPhone ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
                    </button>
                </div>
            </section>

            {/* Notificações */}
            <section className="card">
                <div className="flex items-center gap-3 mb-2">
                    <Bell size={18} className="text-emerald-500" />
                    <h3 className="font-bold">Notificações</h3>
                </div>
                <p className="text-xs text-slate-400 mb-5">
                    Receba alertas por e-mail e WhatsApp quando licenças ou outorgas se aproximarem do vencimento.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block flex items-center gap-1.5">
                            <Mail size={12} /> E-mail para notificações
                        </label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="seu@email.com"
                            value={notifEmail}
                            onChange={e => setNotifEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block flex items-center gap-1.5">
                            <MessageSquare size={12} /> WhatsApp para notificações
                        </label>
                        <input
                            className="form-input"
                            placeholder="(94) 99999-9999"
                            value={formatPhoneDisplay(notifWhatsApp)}
                            onChange={e => setNotifWhatsApp(e.target.value.replace(/\D/g, ''))}
                            maxLength={16}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Notificações WhatsApp requerem configuração do serviço de mensagens (Evolution API).</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <p className="text-xs font-semibold text-slate-500">Quais eventos notificar:</p>
                        {[
                            { label: 'Licenças e outorgas próximas do vencimento', value: notifVencimentos, onChange: setNotifVencimentos },
                            { label: 'Datas de renovação se aproximando', value: notifRenovacoes, onChange: setNotifRenovacoes },
                            { label: 'Atualizações e avisos do sistema', value: notifSistema, onChange: setNotifSistema },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-sm">{item.label}</span>
                                <button
                                    onClick={() => item.onChange(!item.value)}
                                    className={`relative w-12 h-7 rounded-full transition-colors ${item.value ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${item.value ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="btn-primary disabled:opacity-50" onClick={handleSaveNotif} disabled={savingNotif}>
                        {savingNotif ? 'Salvando...' : 'Salvar Preferências'}
                    </button>
                </div>
            </section>

            {/* NFS-e */}
            <section className="card">
                <div className="flex items-center gap-3 mb-6">
                    <FileText size={18} className="text-emerald-500" />
                    <div>
                        <h3 className="font-bold">NFS-e — Dados Fiscais do Prestador</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Informações usadas na emissão de notas fiscais via Focus NF-e</p>
                    </div>
                </div>
                {loadingNfse ? (
                    <p className="text-sm text-slate-400">Carregando...</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">CNPJ do Prestador</label>
                                <input className="form-input" value={nfse.cnpj_prestador || ''} onChange={e => setNfseField('cnpj_prestador', e.target.value)} placeholder="00.000.000/0001-00" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Inscrição Municipal</label>
                                <input className="form-input" value={nfse.inscricao_mun || ''} onChange={e => setNfseField('inscricao_mun', e.target.value)} placeholder="Ex: 123456" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Razão Social</label>
                                <input className="form-input" value={nfse.razao_social || ''} onChange={e => setNfseField('razao_social', e.target.value)} placeholder="Nome da empresa conforme CNPJ" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Código IBGE do Município</label>
                                <input className="form-input" value={nfse.municipio_ibge || ''} onChange={e => setNfseField('municipio_ibge', e.target.value)} placeholder="1504208 (Marabá-PA)" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">UF</label>
                                <input className="form-input" value={nfse.uf || ''} onChange={e => setNfseField('uf', e.target.value)} placeholder="PA" maxLength={2} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Código do Serviço</label>
                                <input className="form-input" value={nfse.codigo_servico || ''} onChange={e => setNfseField('codigo_servico', e.target.value)} placeholder="7.02" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Alíquota ISS (%)</label>
                                <input className="form-input" type="number" step="0.01" min="0" max="10" value={nfse.aliquota_iss ?? 3} onChange={e => setNfseField('aliquota_iss', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">
                                    Discriminação Padrão
                                    <span className="text-slate-400 font-normal ml-1">(use {'{competencia}'} como variável)</span>
                                </label>
                                <textarea className="form-input resize-none" rows={2} value={nfse.discriminacao_padrao || ''} onChange={e => setNfseField('discriminacao_padrao', e.target.value)} placeholder="Assessoria Ambiental - Referente à competência {competencia}" />
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 mt-2">
                            <p className="text-xs font-semibold text-slate-500 mb-3">Credenciais Focus NF-e</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-500 mb-2 block">Token de Acesso</label>
                                    <input
                                        className="form-input font-mono text-sm"
                                        type="password"
                                        value={nfse.focusnfe_token || ''}
                                        onChange={e => setNfseField('focusnfe_token', e.target.value)}
                                        placeholder="Cole aqui o token gerado na sua conta Focus NF-e"
                                        autoComplete="off"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Encontre em: focusnfe.com.br → Configurações → Tokens de acesso</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-2 block">Ambiente</label>
                                    <select
                                        className="form-input"
                                        value={nfse.focusnfe_ambiente || 'homologacao'}
                                        onChange={e => setNfseField('focusnfe_ambiente', e.target.value)}
                                    >
                                        <option value="homologacao">Homologação (testes)</option>
                                        <option value="producao">Produção</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button className="btn-primary disabled:opacity-50" onClick={handleSaveNfse} disabled={savingNfse}>
                            {savingNfse ? 'Salvando...' : 'Salvar Configuração NFS-e'}
                        </button>
                    </div>
                )}
            </section>

            {/* Admin Panel */}
            {isAdmin && (
                <section className="card border border-emerald-200 dark:border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield size={18} className="text-emerald-500" />
                        <h3 className="font-bold">Painel Administrativo</h3>
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Apenas Admins</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-6">Gerencie usuários, papéis e convites de acesso ao sistema.</p>

                    {/* Invite user */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] mb-6">
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus size={14} className="text-emerald-500" /> Convidar Novo Usuário</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nome</label>
                                <input className="form-input" placeholder="Nome do usuário" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">E-mail *</label>
                                <input className="form-input" type="email" placeholder="usuario@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                            </div>
                        </div>
                        <button className="btn-primary disabled:opacity-50" onClick={handleSendInvite} disabled={sendingInvite || !inviteEmail}>
                            {sendingInvite ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : <><Mail size={15} /> Enviar Convite por Magic Link</>}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-2">O usuário receberá um link de acesso por e-mail para fazer login.</p>
                    </div>

                    {/* Pending invites */}
                    {invites.length > 0 && (
                        <div className="mb-6">
                            <p className="text-xs font-semibold text-slate-500 mb-3">Convites pendentes ({invites.length})</p>
                            <div className="space-y-2">
                                {invites.map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                                        <div>
                                            <p className="text-sm font-medium">{inv.name || inv.email}</p>
                                            <p className="text-[10px] text-slate-400">{inv.email} · {inv.status === 'pending' ? 'Aguardando aceitação' : 'Aceito'}</p>
                                        </div>
                                        <button onClick={() => handleDeleteInvite(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-300 hover:text-red-500 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Users list */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-2"><Users size={12} /> Usuários cadastrados ({profiles.length})</p>
                        {loadingAdmin ? (
                            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
                        ) : (
                            <div className="space-y-2">
                                {profiles.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                {(p.full_name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{p.full_name || 'Sem nome'}</p>
                                                <div className="flex items-center gap-2">
                                                    {p.phone && <p className="text-[10px] text-slate-400">{p.phone}</p>}
                                                    {p.role === 'admin' && (
                                                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                            <ShieldCheck size={9} /> Admin
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.role === 'admin' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06]'}`}>
                                                {p.role === 'admin' ? 'Admin' : 'Usuário'}
                                            </span>
                                            {p.id !== user?.id && (
                                                <button
                                                    onClick={() => handleToggleRole(p.id, p.role)}
                                                    className="text-[10px] text-slate-400 hover:text-emerald-500 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                                    title={p.role === 'admin' ? 'Revogar admin' : 'Promover a admin'}
                                                >
                                                    {p.role === 'admin' ? 'Revogar' : 'Promover'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    )
}
