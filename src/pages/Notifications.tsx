import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, Trash2 } from 'lucide-react';
import { loadJson, saveJson, type NotificationItem } from '../lib/storage';
import { useNavigation } from '../lib/navigation';

const seedNotifications: NotificationItem[] = [
  { id: 'seed-1', type: 'warning', title: 'Licença Vencendo', message: 'A Licença de Operação da Fazenda Boa Esperança vence em 15 dias.', time: 'Há 2 horas', read: false, createdAt: Date.now() - 2 * 60 * 60 * 1000 },
  { id: 'seed-2', type: 'success', title: 'Pagamento Confirmado', message: 'O pagamento de R$ 4.500,00 da Indústria ABC Ltda foi recebido.', time: 'Há 4 horas', read: false, createdAt: Date.now() - 4 * 60 * 60 * 1000 },
  { id: 'seed-3', type: 'info', title: 'Nova Tarefa', message: 'Você foi atribuído à tarefa "Vistoria Técnica" para o Posto Central.', time: 'Há 1 dia', read: true, createdAt: Date.now() - 24 * 60 * 60 * 1000 },
  { id: 'seed-4', type: 'error', title: 'Documento Rejeitado', message: 'O EIA/RIMA da Mineração XYZ foi devolvido para correções.', time: 'Há 2 dias', read: true, createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000 },
];

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { navigate } = useNavigation();

  useEffect(() => {
    const stored = loadJson<NotificationItem[]>('ecofin.notifications.v1', []);
    if (stored.length > 0) {
      setNotifications(stored);
      setHydrated(true);
      return;
    }
    saveJson('ecofin.notifications.v1', seedNotifications);
    setNotifications(seedNotifications);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJson('ecofin.notifications.v1', notifications);
  }, [hydrated, notifications]);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-slate-500">Fique por dentro das atualizações importantes.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
          </span>
          <button
            onClick={markAllAsRead}
            className="text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Marcar todas como lidas
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
              <Bell className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-900">Nenhuma notificação</p>
              <p className="text-sm">Você está em dia com todas as atualizações.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 sm:p-6 flex items-start gap-4 transition-colors hover:bg-slate-50/50 group cursor-pointer ${
                  !notification.read ? 'bg-emerald-50/30' : ''
                }`}
                onClick={() => {
                  if (notification.title.toLowerCase().includes('pagamento')) {
                    navigate('/financial');
                  } else if (
                    notification.title.toLowerCase().includes('licença') ||
                    notification.title.toLowerCase().includes('tarefa')
                  ) {
                    navigate('/kanban');
                  } else {
                    navigate('/notifications');
                  }
                }}
              >
                <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${
                  notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  notification.type === 'error' ? 'bg-rose-100 text-rose-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {notification.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                   notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                   notification.type === 'error' ? <AlertTriangle className="w-5 h-5" /> :
                   <Info className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className={`font-semibold truncate ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {notification.time}
                    </span>
                  </div>
                  <p className={`text-sm ${!notification.read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {notification.message}
                  </p>
                </div>

                <button 
                  onClick={() => deleteNotification(notification.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Excluir notificação"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
