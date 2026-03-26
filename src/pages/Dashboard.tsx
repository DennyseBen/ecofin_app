import React, { useMemo } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Users
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, isValid, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadJson, type NotificationItem } from '../lib/storage';
import { useNavigation } from '../lib/navigation';

type TxType = 'income' | 'expense';
interface Transaction {
  id: string;
  dateIso: string;
  description: string;
  client: string;
  amount: number;
  type: TxType;
  status: 'Pago' | 'Pendente';
}

interface KanbanTask {
  id: string;
  title: string;
  client: string;
  dueDateIso?: string;
  priority: 'low' | 'medium' | 'high';
  archived?: boolean;
}
interface KanbanColumn {
  id: string;
  title: string;
  taskIds: string[];
}
interface KanbanData {
  tasks: Record<string, KanbanTask>;
  columns: Record<string, KanbanColumn>;
  columnOrder: string[];
}

interface Client {
  id: string;
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  location: string;
  status: 'Ativo' | 'Em Análise' | 'Inativo';
}

export default function Dashboard() {
  const { navigate } = useNavigation();
  const clients = loadJson<Client[]>('ecofin.clients.v1', []);
  const kanban = loadJson<KanbanData | null>('ecofin.kanban.v1', null);
  const transactions = loadJson<Transaction[]>('ecofin.transactions.v1', []);
  const notifications = loadJson<NotificationItem[]>('ecofin.notifications.v1', []);

  const licenseStats = useMemo(() => {
    const allTasks = kanban ? Object.values(kanban.tasks) : [];
    const activeTasks = allTasks.filter((t) => !t.archived);
    const analysisColumnIds = kanban
      ? kanban.columnOrder.filter((cid) => kanban.columns[cid]?.title.toLowerCase().includes('análise'))
      : [];
    const analysisSet = new Set<string>();
    if (kanban) {
      for (const cid of analysisColumnIds) {
        for (const tid of kanban.columns[cid]?.taskIds ?? []) analysisSet.add(tid);
      }
    }
    const inAnalysis = activeTasks.filter((t) => analysisSet.has(t.id));

    const now = new Date();
    const dueSoon = activeTasks.filter((t) => {
      if (!t.dueDateIso) return false;
      const d = parseISO(t.dueDateIso);
      if (!isValid(d)) return false;
      const days = differenceInCalendarDays(d, now);
      return days >= 0 && days <= 30;
    });

    return {
      active: activeTasks.length,
      inAnalysis: inAnalysis.length,
      dueSoon: dueSoon.length,
      clients: clients.length,
    };
  }, [clients.length, kanban]);

  const cashflowData = useMemo(() => {
    if (!transactions.length) {
      return [
        { name: 'Jan', revenue: 0, expenses: 0 },
        { name: 'Fev', revenue: 0, expenses: 0 },
        { name: 'Mar', revenue: 0, expenses: 0 },
        { name: 'Abr', revenue: 0, expenses: 0 },
        { name: 'Mai', revenue: 0, expenses: 0 },
        { name: 'Jun', revenue: 0, expenses: 0 },
        { name: 'Jul', revenue: 0, expenses: 0 },
      ];
    }

    const byMonth = new Map<string, { month: string; revenue: number; expenses: number }>();
    for (const t of transactions) {
      const key = t.dateIso.slice(0, 7);
      const entry = byMonth.get(key) ?? { month: key, revenue: 0, expenses: 0 };
      if (t.type === 'income') entry.revenue += t.amount;
      else entry.expenses += t.amount;
      byMonth.set(key, entry);
    }
    const rows = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-7);
    return rows.map((r) => {
      const d = parseISO(`${r.month}-01`);
      const name = isValid(d) ? format(d, 'MMM', { locale: ptBR }) : r.month;
      return { name, revenue: r.revenue, expenses: r.expenses };
    });
  }, [transactions]);

  const recentActivities = useMemo(() => {
    return [...notifications]
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 4)
      .map((n) => {
        const icon =
          n.type === 'success' ? CheckCircle2 :
          n.type === 'warning' ? AlertTriangle :
          n.type === 'error' ? AlertTriangle :
          TrendingUp;
        const color =
          n.type === 'success' ? 'text-emerald-500' :
          n.type === 'warning' ? 'text-amber-500' :
          n.type === 'error' ? 'text-rose-500' :
          'text-blue-500';
        return { title: n.title, desc: n.message, time: n.time, icon, color };
      });
  }, [notifications]);

  const stats = useMemo(() => ([
    { name: 'Licenças Ativas', value: String(licenseStats.active), icon: FileText, change: 'Atual', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { name: 'Em Análise', value: String(licenseStats.inAnalysis), icon: Clock, change: 'Atual', color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Vencendo em 30d', value: String(licenseStats.dueSoon), icon: AlertTriangle, change: 'Atual', color: 'text-rose-600', bg: 'bg-rose-100' },
    { name: 'Clientes', value: String(licenseStats.clients), icon: Users, change: 'Total', color: 'text-blue-600', bg: 'bg-blue-100' },
  ]), [licenseStats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500">Acompanhe o status das licenças e saúde financeira.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => (
          <button
            key={stat.name}
            type="button"
            onClick={() => {
              if (stat.name.includes('Cliente')) navigate('/crm');
              else navigate('/kanban');
            }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-left hover:border-emerald-500/30 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <span className="text-xs font-medium text-emerald-600">
                Clique para ver detalhes
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-slate-900">{stat.value}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">{stat.name}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Fluxo de Caixa</h2>
            <button
              type="button"
              onClick={() => navigate('/financial')}
              className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
            >
              Ver Relatório Completo &rarr;
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" name="Receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Atividades Recentes</h2>
          <div className="space-y-6">
            {recentActivities.length === 0 ? (
              <div className="text-sm text-slate-500">Sem atividades registradas ainda.</div>
            ) : recentActivities.map((activity, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1">
                  <activity.icon className={`w-5 h-5 ${activity.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{activity.desc}</p>
                  <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
