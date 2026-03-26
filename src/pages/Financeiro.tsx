import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { fetchTransacoes, insertTransacao, updateTransacao, deleteTransacao } from '../lib/api'
import type { Transacao } from '../lib/types'

const statusMap: Record<string, { label: string; cls: string }> = {
    pago: { label: 'Pago', cls: 'badge-green' },
    paid: { label: 'Pago', cls: 'badge-green' },
    pendente: { label: 'Pendente', cls: 'badge-yellow' },
    pending: { label: 'Pendente', cls: 'badge-yellow' },
    atrasado: { label: 'Atrasado', cls: 'badge-red' },
    overdue: { label: 'Atrasado', cls: 'badge-red' },
}

export default function Financeiro() {
    const { data: transactions, loading, refetch } = useSupabase(fetchTransacoes, [])
    const [showNew, setShowNew] = useState(false)
    const [editing, setEditing] = useState<Transacao | null>(null)
    const [form, setForm] = useState<any>({ descricao: '', tipo: 'income', valor: '', data: '', status: 'pending', cliente_nome: '' })

    const totalIncome = transactions.filter(t => t.tipo === 'income' || t.tipo === 'receita').reduce((a, b) => a + Number(b.valor), 0)
    const totalExpense = transactions.filter(t => t.tipo === 'expense' || t.tipo === 'despesa').reduce((a, b) => a + Number(b.valor), 0)

    const openNew = () => {
        setForm({ descricao: '', tipo: 'income', valor: '', data: new Date().toISOString().split('T')[0], status: 'pending', cliente_nome: '' })
        setShowNew(true)
    }

    const openEdit = (t: Transacao) => {
        setForm({ ...t, data: t.data?.split('T')[0] || '', valor: String(t.valor) })
        setEditing(t)
    }

    const handleSave = async () => {
        if (!form.descricao?.trim() || !form.valor) return
        try {
            const payload = { ...form, valor: Number(form.valor) }
            if (editing) {
                await updateTransacao(editing.id, payload)
                setEditing(null)
            } else {
                await insertTransacao(payload)
                setShowNew(false)
            }
            refetch()
        } catch (e) { alert('Erro ao salvar') }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir transação?')) return
        try { await deleteTransacao(id); refetch() } catch (e) { alert('Erro') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>

    const isIncome = (tipo: string) => tipo === 'income' || tipo === 'receita'

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-extrabold tracking-tight">Financeiro</h1>
                <button className="btn-primary" onClick={openNew}><Plus size={18} /> Nova Transação</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card-hover">
                    <div className="flex items-center gap-3 mb-3"><span className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10"><TrendingUp size={18} className="text-emerald-500" /></span><span className="text-sm text-slate-400">Receitas</span></div>
                    <p className="text-2xl font-extrabold text-emerald-500">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="card-hover">
                    <div className="flex items-center gap-3 mb-3"><span className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-500/10"><TrendingDown size={18} className="text-red-500" /></span><span className="text-sm text-slate-400">Despesas</span></div>
                    <p className="text-2xl font-extrabold text-red-500">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="card-hover">
                    <div className="flex items-center gap-3 mb-3"><span className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-500/10"><DollarSign size={18} className="text-sky-500" /></span><span className="text-sm text-slate-400">Saldo</span></div>
                    <p className="text-2xl font-extrabold">{(totalIncome - totalExpense) > 0 ? '+' : ''}R$ {(totalIncome - totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02]">
                            <th className="table-header px-6 pt-4">Descrição</th>
                            <th className="table-header px-4 pt-4">Tipo</th>
                            <th className="table-header px-4 pt-4">Data</th>
                            <th className="table-header px-4 pt-4">Valor</th>
                            <th className="table-header px-4 pt-4">Status</th>
                            <th className="table-header px-6 pt-4 text-right">Ações</th>
                        </tr></thead>
                        <tbody className="text-sm">
                            {transactions.map(t => (
                                <tr key={t.id} className="table-row border-b border-slate-50 dark:border-white/[0.02] last:border-0">
                                    <td className="py-3.5 px-6 font-medium">{t.descricao}</td>
                                    <td className="py-3.5 px-4">
                                        {isIncome(t.tipo) ? (
                                            <span className="flex items-center gap-1 text-emerald-500 text-xs font-semibold"><ArrowUpRight size={14} /> Receita</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-500 text-xs font-semibold"><ArrowDownRight size={14} /> Despesa</span>
                                        )}
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-400 text-xs">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                                    <td className={`py-3.5 px-4 font-bold ${isIncome(t.tipo) ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {isIncome(t.tipo) ? '+' : '-'}R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className={`badge ${statusMap[t.status?.toLowerCase()]?.cls || 'badge-yellow'}`}>{statusMap[t.status?.toLowerCase()]?.label || t.status}</span>
                                    </td>
                                    <td className="py-3.5 px-6 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openEdit(t)} className="p-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Nenhuma transação encontrada.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Nova/Editar Transação */}
            {(showNew || editing) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowNew(false); setEditing(null) }}>
                    <div className="bg-white dark:bg-[#0d1a14] rounded-3xl border border-slate-100 dark:border-white/[0.06] w-full max-w-lg p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-extrabold mb-6">{editing ? 'Editar Transação' : 'Nova Transação'}</h2>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição *</label><input className="form-input" value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                                    <select className="form-select" value={form.tipo || 'income'} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}>
                                        <option value="income">Receita</option><option value="expense">Despesa</option>
                                    </select></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Valor (R$) *</label><input type="number" step="0.01" className="form-input" value={form.valor || ''} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Data</label><input type="date" className="form-input" value={form.data || ''} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
                                    <select className="form-select" value={form.status || 'pending'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                                        <option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Atrasado</option>
                                    </select></div>
                            </div>
                            <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Cliente (opcional)</label><input className="form-input" value={form.cliente_nome || ''} onChange={e => setForm((f: any) => ({ ...f, cliente_nome: e.target.value }))} /></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
                            <button className="btn-ghost" onClick={() => { setShowNew(false); setEditing(null) }}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSave}><Save size={16} /> {editing ? 'Atualizar' : 'Salvar'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
