import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Archive, Calendar, ClipboardList, Plus, X } from 'lucide-react';
import { format, isAfter, isBefore, isValid, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { addNotification, loadJson, saveJson, setSelectedClientFilter } from '../lib/storage';
import { useNavigation } from '../lib/navigation';

interface Task {
  id: string;
  title: string;
  client: string;
  dueDateIso?: string; // yyyy-MM-dd
  priority: 'low' | 'medium' | 'high';
  details?: string;
  assignee?: string;
  archived?: boolean;
  dueSoonNotified?: boolean;
}

interface Column {
  id: string;
  title: string;
  taskIds: string[];
}

interface BoardData {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
}

const seedData: BoardData = {
  tasks: {
    'task-1': { id: 'task-1', title: 'Coleta de Documentos', client: 'Fazenda Boa Esperança', dueDateIso: '2026-03-15', priority: 'medium', details: 'Solicitar documentos iniciais e conferir pendências.', assignee: 'Ana', archived: false },
    'task-2': { id: 'task-2', title: 'EIA/RIMA', client: 'Mineração XYZ', dueDateIso: '2026-03-20', priority: 'high', details: 'Preparar estudo e anexos. Revisar conformidade.', assignee: 'Diego', archived: false },
    'task-3': { id: 'task-3', title: 'Renovação LO', client: 'Indústria ABC Ltda', dueDateIso: '2026-04-05', priority: 'low', details: 'Checar histórico e montar dossiê de renovação.', assignee: '', archived: false },
    'task-4': { id: 'task-4', title: 'Vistoria Técnica', client: 'Posto Central', dueDateIso: '2026-03-10', priority: 'high', details: 'Agendar vistoria e checklist de campo.', assignee: 'Você', archived: false },
  },
  columns: {
    'col-1': { id: 'col-1', title: 'Prospecção', taskIds: ['task-1'] },
    'col-2': { id: 'col-2', title: 'Em Análise', taskIds: ['task-2', 'task-4'] },
    'col-3': { id: 'col-3', title: 'Aprovado', taskIds: ['task-3'] },
    'col-4': { id: 'col-4', title: 'Concluído', taskIds: [] },
  },
  columnOrder: ['col-1', 'col-2', 'col-3', 'col-4'],
};

type TaskDraft = Omit<Task, 'id'> & { columnId: string };

const emptyDraft: TaskDraft = {
  title: '',
  client: '',
  dueDateIso: '',
  priority: 'medium',
  details: '',
  assignee: '',
  archived: false,
  dueSoonNotified: false,
  columnId: 'col-1',
};

export default function Kanban() {
  const [data, setData] = useState<BoardData>(seedData);
  const [hydrated, setHydrated] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { navigate } = useNavigation();

  useEffect(() => {
    const stored = loadJson<BoardData | null>('ecofin.kanban.v1', null);
    if (stored) {
      setData(stored);
      setHydrated(true);
      return;
    }
    saveJson('ecofin.kanban.v1', seedData);
    setData(seedData);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJson('ecofin.kanban.v1', data);
  }, [data, hydrated]);

  // Notificar tarefas com prazo próximo (uma vez).
  useEffect(() => {
    if (!hydrated) return;
    const now = new Date();
    const tasks = Object.values(data.tasks);
    const updates: Record<string, Task> = {};
    let changed = false;

    for (const t of tasks) {
      if (t.archived) continue;
      if (!t.dueDateIso) continue;
      if (t.dueSoonNotified) continue;

      const d = parseISO(t.dueDateIso);
      if (!isValid(d)) continue;
      const days = differenceInCalendarDays(d, now);
      if (days < 0) continue;
      if (days > 30) continue;

      addNotification({
        type: 'warning',
        title: 'Prazo próximo',
        message: `A tarefa "${t.title}" (${t.client}) vence em ${days} dia(s).`,
        time: 'Agora',
      });

      updates[t.id] = { ...t, dueSoonNotified: true };
      changed = true;
    }

    if (changed) {
      setData((prev) => ({ ...prev, tasks: { ...prev.tasks, ...updates } }));
    }
  }, [data.tasks, hydrated]);

  const archivedTasks = useMemo(
    () => Object.values(data.tasks).filter((t) => t.archived),
    [data.tasks],
  );

  const openNew = (columnId?: string) => {
    setEditingTaskId(null);
    setDraft({ ...emptyDraft, columnId: columnId ?? 'col-1' });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (taskId: string) => {
    const task = data.tasks[taskId];
    if (!task) return;
    const colId = data.columnOrder.find((cId) => data.columns[cId].taskIds.includes(taskId)) ?? 'col-1';
    setEditingTaskId(taskId);
    setDraft({
      ...emptyDraft,
      ...task,
      dueDateIso: task.dueDateIso ?? '',
      details: task.details ?? '',
      assignee: task.assignee ?? '',
      columnId: colId,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTaskId(null);
    setDraft(emptyDraft);
    setError(null);
  };

  const upsertTask = () => {
    const title = draft.title.trim();
    const client = draft.client.trim();
    const dueDateIso = (draft.dueDateIso ?? '').trim();

    if (!title || !client) {
      setError('Preencha pelo menos Título e Cliente.');
      return;
    }
    if (dueDateIso) {
      const parsed = parseISO(dueDateIso);
      if (!isValid(parsed)) {
        setError('Data inválida.');
        return;
      }
    }

    const normalized: Omit<Task, 'id'> = {
      title,
      client,
      dueDateIso: dueDateIso || undefined,
      priority: draft.priority,
      details: (draft.details ?? '').trim() || undefined,
      assignee: (draft.assignee ?? '').trim() || undefined,
      archived: false,
      // só re-notifica prazo se usuário mudar a data depois
      dueSoonNotified: editingTaskId ? data.tasks[editingTaskId]?.dueSoonNotified : false,
    };

    // se mudar dueDate, permitir nova notificação de prazo próximo
    if (editingTaskId && data.tasks[editingTaskId]?.dueDateIso !== normalized.dueDateIso) {
      normalized.dueSoonNotified = false;
    }

    setData((prev) => {
      const next = structuredClone(prev) as BoardData;

      if (editingTaskId) {
        next.tasks[editingTaskId] = { id: editingTaskId, ...normalized };
        // garantir que está na coluna escolhida
        for (const colId of next.columnOrder) {
          next.columns[colId].taskIds = next.columns[colId].taskIds.filter((id) => id !== editingTaskId);
        }
        next.columns[draft.columnId].taskIds.unshift(editingTaskId);
        return next;
      }

      const id = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      next.tasks[id] = { id, ...normalized };
      next.columns[draft.columnId].taskIds.unshift(id);

      if (normalized.assignee) {
        addNotification({
          type: 'info',
          title: 'Nova tarefa',
          message: `Você foi atribuído à tarefa "${normalized.title}" para ${normalized.client}.`,
          time: 'Agora',
        });
      }

      return next;
    });

    closeModal();
  };

  const archiveTask = (taskId: string) => {
    setData((prev) => {
      if (!prev.tasks[taskId]) return prev;
      const next = structuredClone(prev) as BoardData;
      next.tasks[taskId] = { ...next.tasks[taskId], archived: true };
      for (const colId of next.columnOrder) {
        next.columns[colId].taskIds = next.columns[colId].taskIds.filter((id) => id !== taskId);
      }
      return next;
    });
    addNotification({
      type: 'success',
      title: 'Cartão arquivado',
      message: 'Um cartão foi arquivado no Kanban.',
      time: 'Agora',
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const start = data.columns[source.droppableId];
    const finish = data.columns[destination.droppableId];

    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = {
        ...start,
        taskIds: newTaskIds,
      };

      setData({
        ...data,
        columns: {
          ...data.columns,
          [newColumn.id]: newColumn,
        },
      });
      return;
    }

    // Moving from one list to another
    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = {
      ...start,
      taskIds: startTaskIds,
    };

    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = {
      ...finish,
      taskIds: finishTaskIds,
    };

    setData({
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    });
  };

  const formatDue = (dueDateIso?: string) => {
    if (!dueDateIso) return 'Sem prazo';
    const d = parseISO(dueDateIso);
    if (!isValid(d)) return 'Sem prazo';
    return format(d, "dd MMM", { locale: ptBR });
  };

  const dueState = (dueDateIso?: string) => {
    if (!dueDateIso) return 'none';
    const d = parseISO(dueDateIso);
    if (!isValid(d)) return 'none';
    const now = new Date();
    if (isBefore(d, now)) return 'overdue';
    const days = differenceInCalendarDays(d, now);
    if (days <= 7) return 'soon';
    if (days <= 30) return 'near';
    return 'ok';
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Licenças (Kanban)</h1>
          <p className="text-slate-500">Acompanhe o progresso das licenças ambientais.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2",
              showArchived ? "ring-2 ring-emerald-500/20 border-emerald-300" : ""
            )}
          >
            <Archive className="w-5 h-5" />
            Arquivadas
            <span className="ml-1 text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
              {archivedTasks.length}
            </span>
          </button>
          <button
            onClick={() => openNew()}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Cartão
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 h-full items-start">
            {data.columnOrder.map((columnId) => {
              const column = data.columns[columnId];
              const tasks = column.taskIds
                .map((taskId) => data.tasks[taskId])
                .filter(Boolean)
                .filter((t) => !t.archived);

              return (
                <div key={column.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 max-h-full">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      {column.title}
                      <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                        {tasks.length}
                      </span>
                    </h3>
                    <button
                      onClick={() => openNew(column.id)}
                      className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
                      title="Adicionar cartão"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 overflow-y-auto space-y-3 min-h-[150px] transition-colors rounded-xl",
                          snapshot.isDraggingOver ? "bg-slate-200/50" : ""
                        )}
                      >
                        {tasks.map((task, index) => (
                          // @ts-expect-error - React 19 type issue with key prop
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "bg-white p-4 rounded-xl shadow-sm border border-slate-200 group hover:border-emerald-500/30 transition-all",
                                  snapshot.isDragging ? "shadow-lg ring-2 ring-emerald-500/20 rotate-2" : ""
                                )}
                              >
                                <div className="flex justify-between items-start mb-2 gap-3">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md",
                                    task.priority === 'high' ? "bg-rose-100 text-rose-700" :
                                    task.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                                    "bg-emerald-100 text-emerald-700"
                                  )}>
                                    {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(task.id);
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                      title="Editar"
                                    >
                                      <ClipboardList className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        archiveTask(task.id);
                                      }}
                                      className="text-slate-400 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                                      title="Arquivar"
                                    >
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <h4 className="font-medium text-slate-900 mb-1">{task.title}</h4>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClientFilter(task.client);
                                    navigate('/crm');
                                  }}
                                  className="text-sm text-slate-500 mb-4 line-clamp-1 hover:text-emerald-700 underline decoration-dotted underline-offset-2 text-left"
                                >
                                  {task.client}
                                </button>
                                
                                <div className="flex items-center justify-between text-xs font-medium text-slate-400 border-t border-slate-100 pt-3 mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span
                                      className={cn(
                                        dueState(task.dueDateIso) === 'overdue' ? 'text-rose-600' :
                                        dueState(task.dueDateIso) === 'soon' ? 'text-rose-600' :
                                        dueState(task.dueDateIso) === 'near' ? 'text-amber-600' :
                                        'text-slate-500'
                                      )}
                                    >
                                      {formatDue(task.dueDateIso)}
                                    </span>
                                  </div>
                                  {task.priority === 'high' && (
                                    <div className="flex items-center gap-1 text-rose-500">
                                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                                      Urgente
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  
                  <button
                    onClick={() => openNew(column.id)}
                    className="mt-3 w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors border border-dashed border-slate-300 hover:border-slate-400"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Cartão
                  </button>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {showArchived && (
        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Arquivadas</h2>
              <p className="text-sm text-slate-500">Cartões arquivados (somente leitura).</p>
            </div>
            <button
              onClick={() => setShowArchived(false)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 sm:p-5">
            {archivedTasks.length === 0 ? (
              <div className="text-slate-500 text-sm">Nenhum cartão arquivado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {archivedTasks
                  .sort((a, b) => (b.id > a.id ? 1 : -1))
                  .map((t) => (
                    <div key={t.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{t.title}</div>
                          <div className="text-sm text-slate-500 mt-0.5">{t.client}</div>
                        </div>
                        <span className="text-xs font-medium text-slate-500">{formatDue(t.dueDateIso)}</span>
                      </div>
                      {t.details && <div className="text-sm text-slate-600 mt-3 line-clamp-2">{t.details}</div>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeModal} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingTaskId ? 'Editar Cartão' : 'Novo Cartão'}
                </h2>
                <p className="text-sm text-slate-500">Inclua detalhes e prazo para acompanhar o fluxo.</p>
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
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Título *</span>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Renovação LO"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Cliente *</span>
                  <input
                    value={draft.client}
                    onChange={(e) => setDraft((d) => ({ ...d, client: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Indústria ABC Ltda"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Coluna</span>
                  <select
                    value={draft.columnId}
                    onChange={(e) => setDraft((d) => ({ ...d, columnId: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {data.columnOrder.map((cid) => (
                      <option key={cid} value={cid}>{data.columns[cid].title}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Prioridade</span>
                  <select
                    value={draft.priority}
                    onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Task['priority'] }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Prazo</span>
                  <input
                    type="date"
                    value={draft.dueDateIso ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, dueDateIso: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Atribuído a</span>
                  <input
                    value={draft.assignee ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Ex: Você / Ana / Diego"
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Detalhes</span>
                  <textarea
                    value={draft.details ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))}
                    className="w-full min-h-24 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    placeholder="Notas, documentos, próximos passos..."
                  />
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
                  onClick={upsertTask}
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
