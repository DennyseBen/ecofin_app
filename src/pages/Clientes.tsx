import { useState, useMemo, useEffect } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight, Building2, X, FileText, Calendar, Edit2, Trash2, Save, Search as SearchIcon, Loader2, RefreshCw } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { fetchClientes, fetchLicencasByCliente, insertCliente, updateCliente, deleteCliente, consultarCNPJ } from '../lib/api'
import { computeStatus, statusBadgeClass } from '../lib/types'
import type { Cliente, Licenca } from '../lib/types'

const PAGE_SIZE = 20

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

export default function Clientes() {
    const { data: clients, loading, refetch } = useSupabase(fetchClientes, [])
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState<Cliente | null>(null)
    const [relatedLicencas, setRelatedLicencas] = useState<Licenca[]>([])
    const [loadingRel, setLoadingRel] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [editing, setEditing] = useState(false)
    const [fetchingCnpj, setFetchingCnpj] = useState(false)
    const [updatingAll, setUpdatingAll] = useState(false)
    const [form, setForm] = useState({ razao_social: '', cnpj: '', cidade: '', bairro: '', grupo: '', cep: '', celular: '', email: '', logradouro: '', numero: '', complemento: '' })

    useEffect(() => {
        if (selected) {
            setLoadingRel(true)
            fetchLicencasByCliente(selected.razao_social)
                .then(setRelatedLicencas)
                .catch(() => setRelatedLicencas([]))
                .finally(() => setLoadingRel(false))
        }
    }, [selected])

    const filtered = useMemo(() => {
        return clients.filter(c => {
            const s = search.toLowerCase()
            const sCnpj = s.replace(/\D/g, '')
            return (c.razao_social?.toLowerCase().includes(s)) ||
                (c.cnpj?.toLowerCase().includes(s)) ||
                (sCnpj.length > 0 && (c.cnpj || '').replace(/\D/g, '').includes(sCnpj)) ||
                (c.cidade?.toLowerCase().includes(s))
        })
    }, [clients, search])

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const openNew = () => { setForm({ razao_social: '', cnpj: '', cidade: '', bairro: '', grupo: '', cep: '', celular: '', email: '', logradouro: '', numero: '', complemento: '' }); setShowNew(true) }

    const handleSaveNew = async () => {
        if (!form.razao_social.trim()) return
        try {
            await insertCliente(form as any)
            setShowNew(false)
            refetch()
        } catch (e) { alert('Erro ao salvar') }
    }

    const handleCnpjSearch = async () => {
        const cleanCnpj = form.cnpj.replace(/\D/g, '')
        if (cleanCnpj.length !== 14) {
            alert("CNPJ deve conter 14 dígitos válidos.")
            return
        }

        setFetchingCnpj(true)
        try {
            const data = await consultarCNPJ(cleanCnpj)
            setForm(f => ({
                ...f,
                razao_social: data.razao_social || f.razao_social,
                cidade: data.cidade || f.cidade,
                bairro: data.bairro || f.bairro,
                cep: data.cep?.toString().replace(/^(\d{5})(\d{3})$/, '$1-$2') || f.cep,
                email: data.email || f.email,
                celular: data.celular || f.celular,
                logradouro: data.logradouro || f.logradouro,
                numero: data.numero || f.numero,
                complemento: data.complemento || f.complemento
            }))
        } catch (e: any) {
            alert(e.message || "CNPJ não encontrado ou indisponível")
        } finally {
            setFetchingCnpj(false)
        }
    }

    const handleUpdateAllClients = async () => {
        const clientsWithCnpj = clients.filter(c => c.cnpj && c.cnpj.replace(/\D/g, '').length === 14)
        if (clientsWithCnpj.length === 0) return alert("Nenhum cliente com CNPJ válido encontrado para atualizar.")
        
        if (!confirm(`Deseja atualizar dados de endereço de ${clientsWithCnpj.length} clientes via BrasilAPI?`)) return
        
        setUpdatingAll(true)
        let success = 0
        let errors = 0
        
        for (const client of clientsWithCnpj) {
            try {
                const cleanCnpj = client.cnpj!.replace(/\D/g, '')
                const data = await consultarCNPJ(cleanCnpj)
                
                await updateCliente(client.id, {
                    razao_social: data.razao_social || client.razao_social,
                    cidade: data.cidade || client.cidade,
                    bairro: data.bairro || client.bairro,
                    cep: data.cep?.toString().replace(/^(\d{5})(\d{3})$/, '$1-$2') || client.cep,
                    email: data.email || client.email,
                    celular: data.celular || client.celular,
                    logradouro: data.logradouro || client.logradouro,
                    numero: data.numero || client.numero,
                    complemento: data.complemento || client.complemento
                })
                success++
            } catch (err) {
                console.error(`Erro ao atualizar cliente ${client.razao_social}:`, err)
                errors++
            }
        }
        
        setUpdatingAll(false)
        alert(`Atualização concluída!\nSucesso: ${success}\nErros: ${errors}`)
        refetch()
    }

    // Auto Busca ao digitar todos os números se estiver num novo formulário limpo
    useEffect(() => {
        const cleanCnpj = (form.cnpj || '').replace(/\D/g, '')
        if (cleanCnpj.length === 14 && !form.razao_social && !fetchingCnpj) {
            handleCnpjSearch()
        }
    }, [form.cnpj])

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '')
        if (v.length > 14) v = v.slice(0, 14)
        v = v.replace(/^(\d{2})(\d)/, '$1.$2')
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
        setForm(f => ({ ...f, cnpj: v }))
    }

    const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '')
        if (v.length > 8) v = v.slice(0, 8)
        v = v.replace(/^(\d{5})(\d)/, '$1-$2')
        setForm(f => ({ ...f, cep: v }))
    }

    const handleUpdate = async () => {
        if (!selected) return
        try {
            await updateCliente(selected.id, form as any)
            setEditing(false)
            setSelected(null)
            refetch()
        } catch (e) { alert('Erro ao atualizar') }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir este cliente?')) return
        try {
            await deleteCliente(id)
            setSelected(null)
            refetch()
        } catch (e) { alert('Erro ao excluir. Pode haver licenças vinculadas.') }
    }

    const openEdit = (c: Cliente) => {
        setForm({ razao_social: c.razao_social, cnpj: c.cnpj || '', cidade: c.cidade || '', bairro: c.bairro || '', grupo: c.grupo || '', cep: c.cep || '', celular: c.celular || '', email: c.email || '', logradouro: c.logradouro || '', numero: c.numero || '', complemento: c.complemento || '' })
        setEditing(true)
    }

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Clientes</h1>
                    <p className="text-slate-400 text-sm">{filtered.length} clientes encontrados</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        className="btn-ghost" 
                        onClick={handleUpdateAllClients} 
                        disabled={updatingAll}
                    >
                        {updatingAll ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        {updatingAll ? 'Atualizando...' : 'Atualizar Dados (CNPJ)'}
                    </button>
                    <button className="btn-primary" onClick={openNew}><Plus size={18} /> Novo Cliente</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input className="form-input pl-10" placeholder="Pesquisar por nome, CNPJ ou cidade..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                </div>
            </div>

            {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Página {page} de {totalPages} • {filtered.length} resultados</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost !h-9 !px-3 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost !h-9 !px-3 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden !p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02]">
                                <th className="table-header px-6 pt-4">Razão Social</th>
                                <th className="table-header px-6 pt-4">CNPJ</th>
                                <th className="table-header px-6 pt-4">Cidade</th>
                                <th className="table-header px-6 pt-4">Bairro</th>
                                <th className="table-header px-6 pt-4 text-right">Grupo</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {paginated.map((c, i) => (
                                <tr key={i} className="table-row border-b border-slate-50 dark:border-white/[0.02] last:border-0 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-500/[0.03] transition-colors" onClick={() => { setSelected(c); setEditing(false) }}>
                                    <td className="py-3.5 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><Building2 size={14} className="text-emerald-500" /></div>
                                            <span className="font-medium max-w-[250px] truncate">{c.razao_social}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-6 text-slate-400 font-mono text-xs">{c.cnpj || '—'}</td>
                                    <td className="py-3.5 px-6 text-slate-400 text-xs">{c.cidade || '—'}</td>
                                    <td className="py-3.5 px-6 text-slate-400 text-xs">{c.bairro || '—'}</td>
                                    <td className="py-3.5 px-6 text-right text-slate-400 text-xs">{c.grupo || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/[0.04]">
                    <span className="text-xs text-slate-400">Página {page} de {totalPages || 1}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost !h-9 !px-3 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost !h-9 !px-3 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
                    </div>
                </div>
            </div>

            {/* Detail Slide-over */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] border-l border-slate-100 dark:border-white/[0.06] shadow-2xl h-full overflow-y-auto animate-slide-in-left" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.06] p-6 z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-500 mb-1"><Building2 size={16} /><span className="text-xs font-bold uppercase tracking-widest">Cliente</span></div>
                                    <h2 className="text-lg font-bold truncate">{selected.razao_social}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!editing && <button onClick={() => openEdit(selected)} className="p-2 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"><Edit2 size={18} /></button>}
                                    <button onClick={() => handleDelete(selected.id)} className="p-2 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                    <button onClick={() => setSelected(null)} className="p-2 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"><X size={20} /></button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {editing ? (
                                <div className="space-y-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Razão Social</label><input className="form-input" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} /></div>
                                    <div className="relative">
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">CNPJ</label>
                                        <div className="flex gap-2">
                                            <input className="form-input flex-1" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={handleCnpjChange} />
                                            <button onClick={handleCnpjSearch} disabled={fetchingCnpj} className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                                                {fetchingCnpj ? <Loader2 size={20} className="animate-spin" /> : <SearchIcon size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">CEP</label><input className="form-input" placeholder="00000-000" value={form.cep} onChange={handleCepChange} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Celular/Telefone</label><input className="form-input" value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Logradouro</label><input className="form-input" value={form.logradouro} onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Número</label><input className="form-input" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
                                    </div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Complemento</label><input className="form-input" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Bairro</label><input className="form-input" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Cidade</label><input className="form-input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Grupo</label><input className="form-input" value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))} /></div>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
                                        <button className="btn-primary" onClick={handleUpdate}><Save size={16} /> Salvar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">CNPJ</p><p className="text-sm font-medium font-mono">{selected.cnpj || '—'}</p></div>
                                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Grupo</p><p className="text-sm font-medium">{selected.grupo || '—'}</p></div>
                                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Contato</p><p className="text-sm font-medium">{selected.celular || '—'}</p><p className="text-xs text-slate-400 mt-1">{selected.email || '—'}</p></div>
                                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cidade / Bairro</p><p className="text-sm font-medium">{selected.cidade || '—'} / {selected.bairro || '—'}</p><p className="text-xs text-slate-400 mt-1">CEP: {selected.cep || '—'}</p></div>
                                        {(selected.logradouro || selected.numero) && (
                                            <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Endereço</p><p className="text-sm font-medium">{[selected.logradouro, selected.numero, selected.complemento].filter(Boolean).join(', ') || '—'}</p></div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-emerald-500" /> Licenças Vinculadas ({relatedLicencas.length})</h3>
                                        {loadingRel ? (
                                            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div></div>
                                        ) : relatedLicencas.length > 0 ? (
                                            <div className="space-y-2">
                                                {relatedLicencas.map(lic => (
                                                    <div key={lic.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-emerald-500/[0.04] border border-slate-100 dark:border-white/[0.06]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-[10px] font-bold">{lic.tipo}</span>
                                                                <span className="text-xs font-medium truncate">{lic.atividade_licenciada || 'Sem atividade'}</span>
                                                            </div>
                                                            <span className={`badge ${statusBadgeClass(computeStatus(lic))}`}>{computeStatus(lic)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                                                            <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(lic.validade)}</span>
                                                            <span>{lic.departamento || '—'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <p className="text-sm text-slate-400">Nenhuma licença vinculada.</p>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Novo Cliente */}
            {showNew && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
                    <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-white/[0.06] w-full max-w-lg p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-emerald-500 mb-1"><Plus size={18} /><span className="text-[10px] font-bold uppercase tracking-widest">Novo Cliente</span></div>
                        <h2 className="text-xl font-extrabold mb-6">Cadastrar Cliente</h2>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Razão Social *</label><input className="form-input" placeholder="Nome da empresa" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} /></div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">CNPJ (Automático)</label>
                                <div className="flex gap-2">
                                    <input className="form-input flex-1" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={handleCnpjChange} />
                                    <button onClick={handleCnpjSearch} disabled={fetchingCnpj} className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                                        {fetchingCnpj ? <Loader2 size={18} className="animate-spin" /> : <SearchIcon size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">CEP</label><input className="form-input" placeholder="00000-000" value={form.cep} onChange={handleCepChange} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Celular/Telefone</label><input className="form-input" value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Logradouro</label><input className="form-input" value={form.logradouro} onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Número</label><input className="form-input" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
                            </div>
                            <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Complemento</label><input className="form-input" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Bairro</label><input className="form-input" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Cidade</label><input className="form-input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-2 block">Grupo</label><input className="form-input" value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))} /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
                            <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveNew}>Salvar Cliente</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
