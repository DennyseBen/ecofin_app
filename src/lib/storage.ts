export type StorageKey =
  | 'ecofin.clients.v1'
  | 'ecofin.kanban.v1'
  | 'ecofin.transactions.v1'
  | 'ecofin.notifications.v1'
  | 'ecofin.selectedClient.v1';

export function loadJson<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: StorageKey, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export type NotificationType = 'warning' | 'success' | 'info' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAt: number;
}

export function addNotification(input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { read?: boolean }) {
  const now = Date.now();
  const notifications = loadJson<NotificationItem[]>('ecofin.notifications.v1', []);
  const item: NotificationItem = {
    id: `n-${now}-${Math.random().toString(16).slice(2)}`,
    createdAt: now,
    read: input.read ?? false,
    ...input,
  };
  const next = [item, ...notifications].slice(0, 200);
  saveJson('ecofin.notifications.v1', next);
  return item;
}

export function setSelectedClientFilter(name: string) {
  try {
    localStorage.setItem('ecofin.selectedClient.v1', JSON.stringify({ name }));
  } catch {
    // ignore storage errors
  }
}

export function consumeSelectedClientFilter(): string | null {
  try {
    const raw = localStorage.getItem('ecofin.selectedClient.v1');
    if (!raw) return null;
    localStorage.removeItem('ecofin.selectedClient.v1');
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed.name ?? null;
  } catch {
    return null;
  }
}


