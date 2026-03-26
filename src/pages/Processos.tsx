import { useState, useRef, useMemo } from 'react'
import {
    Plus, X, Search, Upload, FileText, Building2,
    Paperclip, Trash2, GripVertical, Clock
} from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import {
    fetchKanbanCards,
    updateKanbanCard,
    insertKanbanCard,
    fetchClientes
} from '../lib/api'
import type { KanbanCard } from '../lib/types'

/* ── Types ── */
interface Attachment {
    id: string
    name: string
    size: number
    uploadedAt: string
    stage: string
}

/* ── Columns ── */
const COLUMNS = [
    { id: 'planejamento', title: 'Planejamento e Enquadramento', emoji: '📋', color: 'border-t-slate-400', desc: 'Definição de CNAE e tipo de licença' },
    { id: 'coleta', title: 'Coleta de Dados e Documentos', emoji: '📁', color: 'border-t-blue-500', desc: 'Reunião de plantas e certidões' },
    { id: 'preenchimento', title: 'Preenchimento e Taxas', emoji: '💰', color: 'border-t-yellow-500', desc: 'Geração de boletos e formulários' },
    { id: 'protocolado', title: 'Protocolado / Em Análise', emoji: '⏳', color: 'border-t-orange-500', desc: 'Processo enviado ao órgão ambiental' },
    { id: 'exigencias', title: 'Exigências e Vistoria', emoji: '🔍', color: 'border-t-red-500', desc: 'Atendimento de comunique-se e visitas técnicas' },
    { id: 'concluido', title: 'Concluído', emoji: '✅', color: 'border-t-emerald-500', desc: 'Licença emitida e condicionantes salvas' },
]

const ACCEPTED_EXTENSIONS = ['.pdf', '.xlsx', '.csv']
const genId = () => Math.random().toString(36).slice(2, 10)

export default function Processos() {
    const { data: serverCards, loading: cardsLoading, refetch } = useSupabase(fetchKanbanCards, [])
    const { data: clients, loading: clientsLoading } = useSupabase(fetchClientes, [])

    // For simplicity we handle optimistic updates via a local state synced with server data.
    // In a real prod environment we might want real-time subscriptions, but this works for MVP.
    const [localCards, setLocalCards] = useState<KanbanCard[]>([])

    // Sync local cards initially when server data loads
    useMemo(() => {
        if (serverCards.length > 0 && localCards.length === 0) {
            setLocalCards(serverCards)
        } else if (serverCards.length > 0 && localCards.length > 0) {
            // We might want to sync cautiously, but let's assume local actions drive it.
            // Setting it directly if we were to refresh.
        }
    }, [serverCards])

    const processos = localCards.length > 0 ? localCards : serverCards

    const [selected, setSelected] = useState<KanbanCard | null>(null)
    const [showNew, setShowNew] = useState(false)
    const [dragId, setDragId] = useState<string | null>(null)

    const [newClient, setNewClient] = useState('')
    const [newType, setNewType] = useState('')
    const [newResp, setNewResp] = useState('')
    const [clientSuggestions, setClientSuggestions] = useState<string[]>([])

    // Attachments mock (since they aren't in Supabase MVP schema natively yet)
    const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({})

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleClientSearch = (val: string) => {
        setNewClient(val)
        if (val.length >= 2) {
            const matches = clients
                .filter(c => c.razao_social.toLowerCase().includes(val.toLowerCase()))
                .map(c => c.razao_social)
                .slice(0, 6)
            setClientSuggestions(matches)
        } else {
            setClientSuggestions([])
        }
    }

    const createProcess = async () => {
        if (!newClient || !newType) return
        const newCard = {
            client_name: newClient,
            license_type: newType,
            responsible: newResp || 'Sistema',
            stage: 'planejamento',
            protocol_number: '',
            tax_due_date: null,
            notes: '',
        }

        try {
            const inserted = await insertKanbanCard(newCard)
            setLocalCards(prev => [...(prev.length ? prev : serverCards), inserted])
            setShowNew(false)
            setNewClient(''); setNewType(''); setNewResp('')
        } catch (e) {
            console.error(e)
            alert('Erro ao criar processo')
        }
    }

    /* Drag & Drop */
    const handleDragStart = (id: string) => setDragId(id)
    const handleDragOver = (e: React.DragEvent) => e.preventDefault()
    const handleDrop = async (colId: string) => {
        if (!dragId) return

        // Optimistic UI update
        const previousCards = [...processos]
        setLocalCards(processos.map(p => p.id === dragId ? { ...p, stage: colId } : p))
        setDragId(null)

        try {
            await updateKanbanCard(dragId, { stage: colId })
        } catch (e) {
            console.error('Failed to move card', e)
            setLocalCards(previousCards) // Revert on failure
        }
    }

    const updateSelected = async (updates: Partial<KanbanCard>) => {
        if (!selected) return

        // Optimistic UI
        const updated = { ...selected, ...updates }
        setSelected(updated)
        setLocalCards(processos.map(p => p.id === updated.id ? updated : p))

        try {
            await updateKanbanCard(updated.id, updates)
        } catch (e) {
            console.error('Failed to update card', e)
            // Ideally revert here
        }
    }

    /* File Upload (Mocked for now since storage wasn't requested in schema) */
    const handleFileUpload = (files: FileList | null) => {
        if (!files || !selected) return
        const newAttachments: Attachment[] = []
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const ext = '.' + file.name.split('.').pop()?.toLowerCase()
            if (!ACCEPTED_EXTENSIONS.includes(ext)) continue
            newAttachments.push({
                id: genId(), name: file.name, size: file.size,
                uploadedAt: new Date().toISOString(),
                stage: COLUMNS.find(c => c.id === selected.stage)?.title || selected.stage,
            })
        }
        if (newAttachments.length > 0) {
            setAttachmentsMap(prev => ({
                ...prev,
                [selected.id]: [...(prev[selected.id] || []), ...newAttachments]
            }))
        }
    }

    const removeAttachment = (attId: string) => {
        if (!selected) return
        setAttachmentsMap(prev => ({
            ...prev,
            [selected.id]: (prev[selected.id] || []).filter(a => a.id !== attId)
        }))
    }

    const handleDragFile = (e: React.DragEvent) => {
        e.preventDefault()
        handleFileUpload(e.dataTransfer.files)
    }

    if (cardsLoading && processos.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Processos</h1>
                    <p className="text-slate-400 text-sm">Gestão de licenciamento ambiental — Kanban</p>
                </div>
                <button className="btn-primary" onClick={() => setShowNew(true)}>
                    <Plus size={18} /> Novo Processo
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max items-start">
                    {COLUMNS.map(col => {
                        const colItems = processos.filter(p => p.stage === col.id)
                        return (
                            <div
                                key={col.id}
                                className={`w-72 flex-shrink-0 card !p-0 border-t-4 ${col.color}`}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(col.id)}
                            >
                                <div className="p-3 border-b border-slate-100 dark:border-white/[0.06]">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{col.emoji}</span>
                                        <h3 className="font-semibold text-xs leading-tight">{col.title}</h3>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{col.desc}</p>
                                    <span className="text-[10px] text-slate-400 font-mono">{colItems.length} processos</span>
                                </div>
                                <div className="p-2 space-y-2 max-h-[55vh] overflow-y-auto min-h-[80px]">
                                    {colItems.map(p => {
                                        const pAttachments = attachmentsMap[p.id] || []
                                        return (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={() => handleDragStart(p.id)}
                                                onClick={() => setSelected(p)}
                                                className={`p-3 rounded-2xl bg-slate-50 dark:bg-emerald-500/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-emerald-200 dark:hover:border-emerald-500/30 cursor-pointer transition-all text-sm group ${dragId === p.id ? 'opacity-50 scale-95' : ''}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <GripVertical size={14} className="text-slate-200 dark:text-slate-700 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate text-xs">{p.client_name}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="px-2 py-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-[10px] font-bold">{p.license_type}</span>
                                                            <span className="text-[10px] text-slate-400">{p.responsible}</span>
                                                        </div>
                                                        {pAttachments.length > 0 && (
                                                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                                                                <Paperclip size={10} /> {pAttachments.length} arquivo(s)
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {colItems.length === 0 && (
                                        <div className="text-center py-6 text-[11px] text-slate-300 dark:text-slate-600">Arraste processos aqui</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Modal: Novo Processo */}
            {showNew && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
                    <div className="bg-white dark:bg-[#0d1a14] rounded-3xl border border-slate-100 dark:border-white/[0.06] w-full max-w-lg p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-emerald-500 mb-1">
                            <Plus size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Novo Processo</span>
                        </div>
                        <h2 className="text-xl font-extrabold mb-6">Iniciar Licenciamento</h2>

                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Empresa / Cliente</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input className="form-input pl-10" placeholder="Digite para buscar..." value={newClient} onChange={e => handleClientSearch(e.target.value)} />
                                </div>
                                {clientSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#0d1a14] border border-slate-100 dark:border-white/[0.08] rounded-2xl shadow-xl z-10 max-h-40 overflow-y-auto">
                                        {clientSuggestions.map((n, i) => (
                                            <button key={i} className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors" onClick={() => { setNewClient(n); setClientSuggestions([]) }}>
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Tipo de Licença</label>
                                <select className="form-select" value={newType} onChange={e => setNewType(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    <option value="LP">Licença Prévia (LP)</option>
                                    <option value="LI">Licença de Instalação (LI)</option>
                                    <option value="LO">Licença de Operação (LO)</option>
                                    <option value="CADRI">CADRI</option>
                                    <option value="DLA">DLA</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Responsável</label>
                                <input className="form-input" placeholder="Nome do responsável (opcional)" value={newResp} onChange={e => setNewResp(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
                            <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={createProcess}>Criar Processo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slide-over: Detalhes do Processo */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div
                        className="relative w-full max-w-xl bg-white dark:bg-[#0d1a14] border-l border-slate-100 dark:border-white/[0.06] shadow-2xl h-full overflow-y-auto animate-slide-in-left"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-white/95 dark:bg-[#0d1a14]/95 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.06] p-6 z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-500 mb-1">
                                        <FileText size={16} />
                                        <span className="text-xs font-bold uppercase tracking-widest">{selected.license_type}</span>
                                    </div>
                                    <h2 className="text-lg font-bold truncate">{selected.client_name}</h2>
                                </div>
                                <button onClick={() => setSelected(null)} className="p-2 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="badge badge-green">{COLUMNS.find(c => c.id === selected.stage)?.title}</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {new Date(selected.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Mover Etapa */}
                            <section>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Etapa Atual</label>
                                <select className="form-select" value={selected.stage} onChange={e => updateSelected({ stage: e.target.value })}>
                                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
                                </select>
                            </section>

                            {/* Dados do Processo */}
                            <section>
                                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                                    <Building2 size={16} className="text-emerald-500" /> Dados do Processo
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Nº Protocolo</label>
                                        <input className="form-input" placeholder="PROT-2025-XXX" value={selected.protocol_number || ''} onChange={e => updateSelected({ protocol_number: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Vencimento da Taxa</label>
                                        <input type="date" className="form-input" value={selected.tax_due_date ? selected.tax_due_date.split('T')[0] : ''} onChange={e => updateSelected({ tax_due_date: e.target.value || null })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Responsável</label>
                                        <input className="form-input" value={selected.responsible || ''} onChange={e => updateSelected({ responsible: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo de Licença</label>
                                        <select className="form-select" value={selected.license_type} onChange={e => updateSelected({ license_type: e.target.value })}>
                                            <option value="LP">LP</option>
                                            <option value="LI">LI</option>
                                            <option value="LO">LO</option>
                                            <option value="CADRI">CADRI</option>
                                            <option value="DLA">DLA</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Notes */}
                            <section>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Observações</label>
                                <textarea className="form-input h-24 resize-none" placeholder="Notas sobre o andamento..." value={selected.notes || ''} onChange={e => updateSelected({ notes: e.target.value })} />
                            </section>

                            {/* Attachments */}
                            <section>
                                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                                    <Paperclip size={16} className="text-emerald-500" /> Anexos
                                    <span className="text-[10px] text-slate-400 font-normal">(PDF, XLSX, CSV)</span>
                                </h3>

                                <div
                                    className="border-2 border-dashed border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 text-center hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all cursor-pointer"
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={handleDragFile}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={28} className="text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Arraste arquivos aqui</p>
                                    <p className="text-xs text-slate-400 mt-1">ou clique para selecionar (.pdf, .xlsx, .csv)</p>
                                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xlsx,.csv" multiple onChange={e => handleFileUpload(e.target.files)} />
                                </div>

                                {(attachmentsMap[selected.id] || []).length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {(attachmentsMap[selected.id] || []).map(att => (
                                            <div key={att.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-emerald-500/[0.04] border border-slate-100 dark:border-white/[0.06]">
                                                <FileText size={16} className="text-emerald-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate">{att.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</span>
                                                        <span className="text-[10px] text-slate-400">•</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(att.uploadedAt).toLocaleDateString('pt-BR')}</span>
                                                        <span className="text-[10px] text-slate-400">•</span>
                                                        <span className="badge badge-blue !text-[9px] !px-1.5 !py-0">{att.stage}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeAttachment(att.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
