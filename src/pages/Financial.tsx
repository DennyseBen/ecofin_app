import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, DollarSign, Download, Filter, Pencil, Plus, Trash2, X } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addNotification, loadJson, saveJson, setSelectedClientFilter } from '../lib/storage';
import { useNavigation } from '../lib/navigation';

type TxType = 'income' | 'expense';
type TxStatus = 'Pago' | 'Pendente';

interface Transaction {
  id: string;
  dateIso: string; // yyyy-MM-dd
  description: string;
  client: string;
  amount: number;
  type: TxType;
  status: TxStatus;
}

const seedTransactions: Transaction[] = [
  { id: 't-1', dateIso: '2026-02-15', description: 'Pagamento Licença Ambiental', client: 'Fazenda Boa Esperança', amount: 4500.0, type: 'income', status: 'Pago' },
  { id: 't-2', dateIso: '2026-02-12', description: 'Taxa Órgão Ambiental', client: 'Mineração XYZ', amount: 1200.0, type: 'expense', status: 'Pago' },
  { id: 't-3', dateIso: '2026-02-10', description: 'Consultoria Técnica', client: 'Indústria ABC Ltda', amount: 8500.0, type: 'income', status: 'Pendente' },
  { id: 't-4', dateIso: '2026-02-05', description: 'Despesas de Viagem', client: 'Posto Central', amount: 350.0, type: 'expense', status: 'Pago' },
];

const emptyDraft: Omit<Transaction, 'id'> = {
  dateIso: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  client: '',
  amount: 0,
  type: 'income',
  status: 'Pago',
};

export default function Financial() {
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const [statusFilter, setStatusFilter] = useState<'Todos' | TxStatus>('Todos');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Transaction, 'id'>>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const { navigate } = useNavigation();

  useEffect(() => {
    const stored = loadJson<Transaction[]>('ecofin.transactions.v1', []);
    if (stored.length > 0) {
      setTransactions(stored);
      setHydrated(true);
      return;
    }
    saveJson('ecofin.transactions.v1', seedTransactions);
    setTransactions(seedTransactions);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJson('ecofin.transactions.v1', transactions);
  }, [hydrated, transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = filter === 'all' ? true : t.type === filter;
      const matchesStatus = statusFilter === 'Todos' ? true : t.status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [filter, statusFilter, transactions]);

  const totals = useMemo(() => {
    const incomePaid = transactions.filter((t) => t.type === 'income' && t.status === 'Pago').reduce((s, t) => s + t.amount, 0);
    const expensePaid = transactions.filter((t) => t.type === 'expense' && t.status === 'Pago').reduce((s, t) => s + t.amount, 0);
    const balance = incomePaid - expensePaid;

    const now = new Date();
    const monthKey = format(now, 'yyyy-MM');
    const monthIncome = transactions
      .filter((t) => t.type === 'income' && t.dateIso.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions
      .filter((t) => t.type === 'expense' && t.dateIso.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0);

    return { balance, monthIncome, monthExpense };
  }, [transactions]);

  const reportData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    for (const t of transactions) {
      const key = t.dateIso.slice(0, 7);
      const entry = map.get(key) ?? { month: key, income: 0, expense: 0 };
      if (t.type === 'income') entry.income += t.amount;
      else entry.expense += t.amount;
      map.set(key, entry);
    }
    const rows = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    const last = rows.slice(-8).map((r) => ({
      ...r,
      label: (() => {
        const d = parseISO(`${r.month}-01`);
        if (!isValid(d)) return r.month;
        return format(d, 'MMM', { locale: ptBR });
      })(),
    }));
    return last;
  }, [transactions]);

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateIso: string) => {
    const d = parseISO(dateIso);
    if (!isValid(d)) return dateIso;
    return format(d, "dd MMM yyyy", { locale: ptBR });
  };

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    const { id: _id, ...rest } = tx;
    setDraft(rest);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
  };

  const upsert = () => {
    const dateIso = (draft.dateIso ?? '').trim();
    const description = draft.description.trim();
    const client = draft.client.trim();
    const amount = Number(draft.amount);
    if (!dateIso || !isValid(parseISO(dateIso))) {
      setError('Data inválida.');
      return;
    }
    if (!description) {
      setError('Descrição é obrigatória.');
      return;
    }
    if (!client) {
      setError('Cliente/Fornecedor é obrigatório.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Valor deve ser maior que zero.');
      return;
    }

    const normalized: Omit<Transaction, 'id'> = {
      ...draft,
      dateIso,
      description,
      client,
      amount,
    };

    if (editingId) {
      setTransactions((prev) => prev.map((t) => (t.id === editingId ? { id: editingId, ...normalized } : t)));
      closeModal();
      return;
    }

    const id = `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setTransactions((prev) => [{ id, ...normalized }, ...prev]);

    addNotification({
      type: normalized.type === 'income' ? 'success' : 'info',
      title: normalized.type === 'income' ? 'Receita registrada' : 'Despesa registrada',
      message: `${normalized.description} — ${formatMoney(normalized.amount)} (${normalized.client}).`,
      time: 'Agora',
    });

    closeModal();
  };

  const remove = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-500">Gerencie receitas, despesas e fluxo de caixa.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button
            onClick={openNew}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Saldo Atual</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatMoney(totals.balance)}</p>
          <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> +15% vs mês anterior
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Receitas (Mês)</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatMoney(totals.monthIncome)}</p>
          <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> +8% vs mês anterior
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Despesas (Mês)</h3>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatMoney(totals.monthExpense)}</p>
          <p className="text-sm text-rose-600 font-medium mt-2 flex items-center gap-1">
            <ArrowDownRight className="w-4 h-4" /> -2% vs mês anterior
          </p>
        </div>
      </div>

      {/* Report */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Relatório</h2>
            <p className="text-sm text-slate-500">Receitas x despesas por mês.</p>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                formatter={(v: number) => formatMoney(v)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
              <Area type="monotone" dataKey="expense" name="Despesas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Transações Recentes</h2>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              aria-label="Filtro tipo"
            >
              <option value="all">Tudo</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              aria-label="Filtro status"
            >
              <option value="Todos">Todos</option>
              <option value="Pago">Pago</option>
              <option value="Pendente">Pendente</option>
            </select>
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Filtros">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Cliente/Fornecedor</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-sm text-slate-500">{formatDate(tx.dateIso)}</td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{tx.description}</p>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientFilter(tx.client);
                        navigate('/crm');
                      }}
                      className="hover:text-emerald-700 underline decoration-dotted underline-offset-2"
                    >
                      {tx.client}
                    </button>
                  </td>
                  <td className={`p-4 text-right font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'income' ? '+' : '-'} {formatMoney(tx.amount)}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      tx.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(tx)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => remove(tx.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeModal} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Editar Transação' : 'Nova Transação'}
                </h2>
                <p className="text-sm text-slate-500">Registre receitas e despesas para acompanhar o caixa.</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-xl px-4 py-3 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Data *</span>
                  <input
                    type="date"
                    value={draft.dateIso}
                    onChange={(e) => setDraft((d) => ({ ...d, dateIso: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Tipo</span>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as TxType }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Descrição *</span>
                  <input
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Taxa órgão ambiental"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Cliente/Fornecedor *</span>
                  <input
                    value={draft.client}
                    onChange={(e) => setDraft((d) => ({ ...d, client: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Indústria ABC Ltda"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Valor *</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TxStatus }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-400">* Campos obrigatórios</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={upsert}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
