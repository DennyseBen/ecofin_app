import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  KanbanSquare, 
  CircleDollarSign, 
  Bell, 
  Menu,
  X,
  Leaf,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { loadJson, type NotificationItem } from '../lib/storage';
import { NavigationProvider } from '../lib/navigation';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'CRM', path: '/crm', icon: Users },
  { name: 'Licenças (Kanban)', path: '/kanban', icon: KanbanSquare },
  { name: 'Financeiro', path: '/financial', icon: CircleDollarSign },
  { name: 'Notificações', path: '/notifications', icon: Bell },
  { name: 'IA (Gemini)', path: '/ai', icon: Sparkles },
];

export default function Layout({ children, currentPath, onNavigate }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);

  useEffect(() => {
    const compute = () => {
      const items = loadJson<NotificationItem[]>('ecofin.notifications.v1', []);
      setUnreadCount(items.filter((n) => !n.read).length);
    };

    compute();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ecofin.notifications.v1') compute();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const items = loadJson<NotificationItem[]>('ecofin.notifications.v1', []);
    setUnreadCount(items.filter((n) => !n.read).length);
  }, [currentPath]);

  return (
    <NavigationProvider currentPath={currentPath} navigate={onNavigate}>
      <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 text-emerald-400 font-bold text-xl hover:text-emerald-300"
          >
            <Leaf className="w-6 h-6" />
            <span>EcoFin Manager</span>
          </button>
          <button 
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.name}
                onClick={() => {
                  onNavigate(item.path);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center w-full gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            <button
              className="relative p-2 text-slate-400 hover:text-slate-500 transition-colors"
              onClick={() => onNavigate('/notifications')}
            >
              <Bell className="w-6 h-6" />
              {hasUnread && (
                <>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
                  <span className="sr-only">{unreadCount} notificações não lidas</span>
                </>
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      </div>
    </NavigationProvider>
  );
}
