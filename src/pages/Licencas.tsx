import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRealtime } from '../hooks/useRealtime'
import { Search, Plus, FileText, Calendar, Building2, X, Edit2, Trash2, Save, ExternalLink, Eye, Droplets, AlertTriangle, RotateCcw, ChevronDown, ChevronUp, ClipboardList, Paperclip, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useSearchParams } from 'react-router-dom'
import { useSupabase } from '../hooks/useSupabase'
import { fetchLicencas, insertLicenca, updateLicenca, deleteLicenca, fetchClientes, fetchOutorgas, insertOutorga, updateOutorga, deleteOutorga, consultarCNPJ } from '../lib/api'
import { computeStatus, statusBadgeClass, getDaysRemaining, isInAlertZone, TIPOS_LICENCA, TIPOS_OUTORGA, getRenovacaoLeadDays } from '../lib/types'
import type { Licenca, Outorga, Cliente } from '../lib/types'
import { importarDocumento } from '../lib/importLicenca'

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

function fmtMonthYear(d: string | null): string {
    if (!d) return ''
    const [y, m] = d.split('T')[0].split('-')
    return `${m}/${y}`
}

function exportRelatorio(licencas: Licenca[], outorgas: Outorga[]) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const today = new Date()
    const mesAno = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()

    const headerFill: [number, number, number] = [74, 95, 75]
    const alertFill: [number, number, number] = [255, 237, 213]
    const alertText: [number, number, number] = [180, 60, 20]

    // Title
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`RELATÓRIO DE RENOVAÇÕES — ${mesAno}`, pageW / 2, 14, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(`Gerado em ${today.toLocaleDateString('pt-BR')}`, pageW / 2, 20, { align: 'center' })
    doc.setTextColor(0)

    // ── Licenças ──
    if (licencas.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Licenças', 14, 28)

        autoTable(doc, {
            startY: 31,
            head: [['Processos', 'Razão Social', 'Cidade', 'RIAA', 'Órgão', 'Renovação', 'Técnico', 'Verificar']],
            body: licencas.map(l => {
                const inAlert = isInAlertZone(l)
                return {
                    cells: [
                        l.processo || (l.pasta ? String(l.pasta) : ''),
                        l.razao_social,
                        l.cidade || '',
                        fmtMonthYear(l.data_riaa),
                        l.departamento || '',
                        formatDate(l.data_renovacao),
                        '',
                        '',
                    ],
                    isAlert: inAlert,
                }
            }).map(r => r.cells),
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const l = licencas[data.row.index]
                    if (l && isInAlertZone(l)) {
                        data.cell.styles.fillColor = alertFill
                        data.cell.styles.textColor = alertText
                        data.cell.styles.fontStyle = 'bold'
                    }
                }
            },
            headStyles: {
                fillColor: headerFill,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8,
            },
            bodyStyles: { halign: 'center', fontSize: 7.5, cellPadding: 2 },
            columnStyles: {
                1: { halign: 'left', cellWidth: 60 },
                2: { cellWidth: 36 },
            },
            alternateRowStyles: { fillColor: [248, 250, 248] },
        })
    }

    // ── Outorgas ──
    if (outorgas.length > 0) {
        const afterLic = (doc as any).lastAutoTable?.finalY ?? 30
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Outorgas', 14, afterLic + 10)

        autoTable(doc, {
            startY: afterLic + 13,
            head: [['Processos', 'Razão Social', 'Cidade', 'Relatório', 'Outorga', 'Renovação', 'Técnico', 'Verificar']],
            body: outorgas.map(o => [
                o.numero_outorga || '',
                o.razao_social,
                '',
                fmtMonthYear(o.data_riaa),
                o.tipo,
                formatDate(o.data_renovacao),
                '',
                '',
            ]),
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const o = outorgas[data.row.index]
                    if (o && isInAlertZone(o)) {
                        data.cell.styles.fillColor = alertFill
                        data.cell.styles.textColor = alertText
                        data.cell.styles.fontStyle = 'bold'
                    }
                }
            },
            headStyles: {
                fillColor: headerFill,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8,
            },
            bodyStyles: { halign: 'center', fontSize: 7.5, cellPadding: 2 },
            columnStyles: {
                1: { halign: 'left', cellWidth: 60 },
                2: { cellWidth: 36 },
            },
            alternateRowStyles: { fillColor: [248, 250, 248] },
        })
    }

    const filename = `renovacoes-${today.toISOString().slice(0, 7)}.pdf`
    doc.save(filename)
}

function computeRenovacaoDate(validade: string | null, tipo: string): string | null {
    if (!validade) return null
    const d = new Date(validade.split('T')[0])
    d.setDate(d.getDate() - getRenovacaoLeadDays(tipo))
    return d.toISOString().split('T')[0]
}

function PdfButton({ url }: { url: string | null }) {
    if (!url) return null
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
        >
            <Eye size={13} /> Visualizar PDF
            <ExternalLink size={11} />
        </a>
    )
}

function SmartAlertBanner({ licencas, outorgas }: { licencas: Licenca[], outorgas: Outorga[] }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const all = [...licencas, ...outorgas]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const items = useMemo(() => {
        return all.map(item => {
            if (!item.validade) return null
            const valDate = new Date(item.validade)
            valDate.setHours(0, 0, 0, 0)
            const daysRemaining = Math.floor((valDate.getTime() - today.getTime()) / 86400000)

            if (daysRemaining < -365) return null // Hide old stuff

            const realLead = getRenovacaoLeadDays(item.tipo)
            const renewalDeadline = new Date(valDate)
            renewalDeadline.setDate(renewalDeadline.getDate() - realLead)

            let urgency: 'atraso' | 'critico' | 'atencao' | null = null

            if (daysRemaining < 0) {
                // Vencida - already handled by main UI status but maybe show here too? 
                // User said "Em atraso — prazo de renovação já passou, mas licença ainda válida"
                // That means today > renewalDeadline AND today < valDate
            }

            if (today >= renewalDeadline && daysRemaining >= 0) urgency = 'atraso'
            if (daysRemaining >= 0 && daysRemaining <= 30) urgency = 'critico'
            else if (daysRemaining > 30 && daysRemaining <= 60) urgency = 'atencao'

            if (!urgency) return null

            return {
                id: item.id,
                razao_social: item.razao_social,
                tipo: item.tipo,
                daysRemaining,
                urgency
            }
        }).filter(Boolean) as any[]
    }, [licencas, outorgas])

    if (items.length === 0) return null

    const counts = {
        atraso: items.filter(i => i.urgency === 'atraso').length,
        critico: items.filter(i => i.urgency === 'critico').length,
        atencao: items.filter(i => i.urgency === 'atencao').length,
    }

    return (
        <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl overflow-hidden shadow-sm animate-fade-in mb-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500" />
                        <span className="text-sm font-bold">Alertas de Renovação</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {counts.atraso > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><div className="w-2 h-2 rounded-full bg-blue-500" /> {counts.atraso} Em atraso</span>}
                        {counts.critico > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-500"><div className="w-2 h-2 rounded-full bg-red-500" /> {counts.critico} Crítico</span>}
                        {counts.atencao > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500"><div className="w-2 h-2 rounded-full bg-amber-500" /> {counts.atencao} Atenção</span>}
                    </div>
                </div>
                {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>

            {isExpanded && (
                <div className="border-t border-slate-100 dark:border-white/[0.06] p-4 bg-slate-50/50 dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.sort((a, b) => a.daysRemaining - b.daysRemaining).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] shadow-sm">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">{item.razao_social}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{item.tipo} • {item.daysRemaining} dias p/ vencer</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${item.urgency === 'critico' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                                    item.urgency === 'atencao' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                                        'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                                    }`}>
                                    {item.urgency === 'atraso' ? 'EM ATRASO' : item.urgency === 'critico' ? 'CRÍTICO' : 'ATENÇÃO'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function Licencas() {
    const [searchParams] = useSearchParams()
    const { data: licencas, loading, refetch } = useSupabase(fetchLicencas, [])
    const { data: outorgas, refetch: refetchOutorgas } = useSupabase(fetchOutorgas, [])
    const { data: clientes } = useSupabase(fetchClientes, [])

    const refetchAll = useCallback(() => { refetch(); refetchOutorgas() }, [refetch, refetchOutorgas])
    useRealtime(['licencas', 'outorgas'], refetchAll)

    const initTab = searchParams.get('tab') === 'outorgas' ? 'Outorgas' : 'Licenças'
    const [activeTab, setActiveTab] = useState<'Licenças' | 'Outorgas'>(initTab)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState(searchParams.get('tipo') || 'all')
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all')
    const [filterRenovar, setFilterRenovar] = useState(false)
    const [filterDias, setFilterDias] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 30
    const [selected, setSelected] = useState<Licenca | null>(null)
    const [selectedOutorga, setSelectedOutorga] = useState<Outorga | null>(null)
    const [editing, setEditing] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState<any>({ razao_social: '', tipo: 'LO', atividade_licenciada: '', departamento: '', validade: '', data_renovacao: '', pdf_url: '', status: 'Válida', cidade: '', cnpj: '' })
    const [pdfModal, setPdfModal] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const [importedFileName, setImportedFileName] = useState<string | null>(null)
    const [cnpjLoading, setCnpjLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCnpjChange = async (raw: string) => {
        const digits = raw.replace(/\D/g, '')
        setForm((f: any) => ({ ...f, cnpj: raw }))
        if (digits.length === 14) {
            setCnpjLoading(true)
            try {
                const data = await consultarCNPJ(digits)
                setForm((f: any) => ({
                    ...f,
                    cnpj: raw,
                    ...(data.razao_social && !f.razao_social ? { razao_social: data.razao_social } : {}),
                    ...(activeTab === 'Licenças' && data.cidade ? { cidade: data.cidade } : {}),
                }))
            } catch {
                // silently ignore — CNPJ may not be in API
            } finally {
                setCnpjLoading(false)
            }
        }
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImporting(true)
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY
            const { fields, fileUrl } = await importarDocumento(file, apiKey)
            setForm((f: any) => ({
                ...f,
                pdf_url: fileUrl,
                ...(fields.razao_social && { razao_social: fields.razao_social }),
                ...(fields.cnpj && { cnpj: fields.cnpj }),
                ...(fields.tipo && { tipo: fields.tipo }),
                ...(fields.validade && { validade: fields.validade }),
                ...(fields.departamento && { departamento: fields.departamento }),
                ...(fields.atividade_licenciada && { atividade_licenciada: fields.atividade_licenciada }),
                ...(fields.processo && { processo: fields.processo }),
                ...(fields.cidade && { cidade: fields.cidade }),
                ...(fields.numero_outorga && { numero_outorga: fields.numero_outorga }),
            }))
            setImportedFileName(file.name)
        } catch (err: any) {
            alert(`Erro ao importar: ${err.message}`)
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Open specific license if ?id= is in URL
    useEffect(() => {
        const idParam = searchParams.get('id')
        if (idParam && licencas.length > 0) {
            const found = licencas.find(l => l.id === Number(idParam))
            if (found) { setSelected(found); setEditing(false) }
        }
    }, [searchParams, licencas])

    // Normalize DB types: collapse variants into canonical names, remove unwanted entries
    const normalizeTipo = (t: string | null): string | null => {
        if (!t) return null
        const upper = t.toUpperCase().trim()
        if (upper === 'ANM' || upper === 'REGISTRO ANM' || upper === 'REGISTRO') return 'Registro ANM'
        if (upper === 'PREFEITO' || upper === 'LICENÇA PREFEITO' || upper === 'LICENCA PREFEITO' || upper === 'LIC. PREFEITO' || upper === 'LIC.PREFEITO') return 'Licença Prefeito'
        if (upper === 'SUPRESSÃO' || upper === 'SUPRESSÃO VEGETAL' || upper === 'SUPRESSAO' || upper === 'SUPRESSAO VEGETAL') return 'Supressão Vegetal'
        if (upper === 'DISPENSA' || upper === 'DISPENSA DE OUTORGA') return 'Dispensa de Outorga'
        if (upper === 'L.I' || upper === 'L. I') return 'LI'
        if (upper === 'CADRI') return null
        return t
    }

    const tipos = useMemo(() => {
        const fromDB = Array.from(new Set(licencas.map(c => normalizeTipo(c.tipo)).filter(Boolean)))
        const canonical = TIPOS_LICENCA.map(t => normalizeTipo(t)).filter(Boolean) as string[]
        const all = Array.from(new Set([...canonical, ...fromDB]))
        return all.sort()
    }, [licencas])

    const tiposOutorga = useMemo(() => {
        return Array.from(new Set([...TIPOS_OUTORGA, ...outorgas.map(o => o.tipo).filter(Boolean)])).sort()
    }, [outorgas])

    const filteredLicencas = useMemo(() => {
        return licencas.filter(c => {
            const s = search.toLowerCase()
            const sCnpj = s.replace(/\D/g, '')
            const matchSearch = String(c.razao_social || '').toLowerCase().includes(s) ||
                String(c.cnpj || '').toLowerCase().includes(s) ||
                String(c.pasta || '').includes(s) ||
                String(c.atividade_licenciada || '').toLowerCase().includes(s) ||
                (sCnpj.length > 0 && String(c.cnpj || '').replace(/\D/g, '').includes(sCnpj))
            const matchType = filterType === 'all' || normalizeTipo(c.tipo) === filterType
            const computed = computeStatus(c)
            const matchStatus = filterStatus === 'all' || computed === filterStatus
            const matchRenovar = !filterRenovar || isInAlertZone(c)
            const matchDias = filterDias === null || (getDaysRemaining(c) !== null && getDaysRemaining(c)! <= filterDias)
            return matchSearch && matchType && matchStatus && matchRenovar && matchDias
        })
    }, [licencas, search, filterType, filterStatus, filterRenovar, filterDias])

    const filteredOutorgas = useMemo(() => {
        return outorgas.filter(o => {
            const s = search.toLowerCase()
            const sCnpj = s.replace(/\D/g, '')
            const matchSearch = String(o.razao_social || '').toLowerCase().includes(s) ||
                String(o.cnpj || '').toLowerCase().includes(s) ||
                String(o.tipo || '').toLowerCase().includes(s) ||
                String(o.numero_outorga || '').toLowerCase().includes(s) ||
                (sCnpj.length > 0 && String(o.cnpj || '').replace(/\D/g, '').includes(sCnpj))
            const matchStatus = filterStatus === 'all' || computeStatus(o) === filterStatus
            const matchRenovar = !filterRenovar || isInAlertZone(o)
            const matchDias = filterDias === null || (getDaysRemaining(o) !== null && getDaysRemaining(o)! <= filterDias)
            return matchSearch && matchStatus && matchRenovar && matchDias
        })
    }, [outorgas, search, filterStatus, filterRenovar, filterDias])

    const activeFiltered = activeTab === 'Licenças' ? filteredLicencas : filteredOutorgas
    const totalPages = Math.ceil(activeFiltered.length / PAGE_SIZE)
    const paginatedItems = activeFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    useEffect(() => {
        setPage(1)
    }, [search, filterType, filterStatus, filterRenovar, filterDias, activeTab])

    const alertCount = useMemo(() => {
        return licencas.filter(isInAlertZone).length + outorgas.filter(isInAlertZone).length
    }, [licencas, outorgas])

    // Auto-fill from CNPJ or Razao Social
    useEffect(() => {
        if (!form.razao_social && !form.cnpj) return
        // Prioritize CNPJ match (branch-specific) before razao_social (too broad for multi-branch companies)
        const match =
            (form.cnpj ? clientes.find(c => c.cnpj && c.cnpj === form.cnpj) : null) ||
            (form.razao_social ? clientes.find(c => c.razao_social === form.razao_social) : null)
        if (match) {
            setForm((prev: any) => ({
                ...prev,
                razao_social: match.razao_social,
                cnpj: match.cnpj || prev.cnpj,
                ...(activeTab === 'Licenças' && {
                    cidade: match.cidade || prev.cidade,
                    bairro: match.bairro || prev.bairro,
                    grupo: match.grupo || prev.grupo,
                }),
            }))
        }
    }, [form.razao_social, form.cnpj, clientes, activeTab])

    // Auto-compute data_renovacao when validade or tipo changes
    const autoComputeRenovacao = useCallback((validade: string, tipo: string) => {
        if (!validade) return ''
        const d = new Date(validade)
        d.setDate(d.getDate() - getRenovacaoLeadDays(tipo))
        return d.toISOString().split('T')[0]
    }, [])

    const handleValidadeChange = (val: string) => {
        const renovacao = autoComputeRenovacao(val, form.tipo || 'LO')
        setForm((f: any) => ({ ...f, validade: val, data_renovacao: renovacao }))
    }

    const handleTipoChange = (tipo: string) => {
        const renovacao = form.validade ? autoComputeRenovacao(form.validade, tipo) : form.data_renovacao
        setForm((f: any) => ({ ...f, tipo, data_renovacao: renovacao }))
    }

    const openNew = () => {
        if (activeTab === 'Outorgas') {
            setForm({ razao_social: '', cnpj: '', tipo: 'Captação Superficial', numero_outorga: '', orgao: '', validade: '', data_renovacao: '', pdf_url: '', status: 'Válida', notas: '', data_riaa: '' })
        } else {
            setForm({ razao_social: '', tipo: 'LO', atividade_licenciada: '', departamento: '', validade: '', data_renovacao: '', pdf_url: '', status: 'Válida', cidade: '', cnpj: '', data_riaa: '' })
        }
        setShowNew(true)
    }

    const openEdit = (item: Licenca | Outorga) => {
        const base = { validade: item.validade ? item.validade.split('T')[0] : '', data_renovacao: item.data_renovacao ? item.data_renovacao.split('T')[0] : '', data_riaa: item.data_riaa ? item.data_riaa.split('T')[0] : '' }
        if (activeTab === 'Outorgas') {
            const o = item as Outorga
            setForm({ razao_social: o.razao_social, cnpj: o.cnpj, tipo: o.tipo, numero_outorga: o.numero_outorga, orgao: o.orgao, validade: base.validade, data_renovacao: base.data_renovacao, pdf_url: o.pdf_url, status: o.status, notas: o.notas, data_riaa: base.data_riaa })
        } else {
            setForm({ ...item, ...base })
        }
        setEditing(true)
    }

    const handleSaveNew = async () => {
        if (!form.razao_social?.trim()) return
        try {
            if (activeTab === 'Outorgas') {
                await insertOutorga(form)
                setShowNew(false)
                setImportedFileName(null)
                refetchOutorgas()
            } else {
                await insertLicenca(form)
                setShowNew(false)
                setImportedFileName(null)
                refetch()
            }
        } catch (e: any) {
            console.error('Erro ao salvar:', e)
            alert(`Erro ao salvar: ${e?.message || 'Verifique os dados e tente novamente.'}`)
        }
    }

    const handleUpdate = async () => {
        try {
            if (activeTab === 'Outorgas' && selectedOutorga) {
                await updateOutorga(selectedOutorga.id, form)
            } else if (selected) {
                await updateLicenca(selected.id, form)
            }
            setEditing(false)
            setSelected(null)
            setSelectedOutorga(null)
            refetch()
            refetchOutorgas()
        } catch (e: any) {
            console.error('Erro ao atualizar:', e)
            alert(`Erro ao atualizar: ${e?.message || 'Verifique os dados e tente novamente.'}`)
        }
    }

    const handleDelete = async (id: number, kind: 'licenca' | 'outorga') => {
        if (!confirm(`Excluir esta ${kind === 'outorga' ? 'outorga' : 'licença'}?`)) return
        try {
            if (kind === 'outorga') { await deleteOutorga(id); setSelectedOutorga(null); refetchOutorgas() }
            else { await deleteLicenca(id); setSelected(null); refetch() }
        } catch (e: any) {
            console.error('Erro ao excluir:', e)
            alert(`Erro ao excluir: ${e?.message || 'Tente novamente.'}`)
        }
    }

    const DetailField = ({ label, value }: { label: string; value: string | number | null }) => (
        <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-medium">{value || '—'}</p>
        </div>
    )

    if (loading && licencas.length === 0) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
    )

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Licenças & Outorgas</h1>
                    <p className="text-slate-400 text-sm">
                        {activeTab === 'Licenças' ? `${filteredLicencas.length} licenças encontradas` : `${filteredOutorgas.length} outorgas encontradas`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {alertCount > 0 && (
                        <button
                            onClick={() => setFilterRenovar(v => !v)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterRenovar ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}
                        >
                            <AlertTriangle size={14} />
                            A Renovar ({alertCount})
                        </button>
                    )}
                    <button
                        onClick={() => exportRelatorio(filteredLicencas, filteredOutorgas)}
                        className="btn-ghost border border-slate-200 dark:border-white/10"
                        title="Exportar tabela atual como PDF"
                    >
                        <Download size={16} /> Exportar PDF
                    </button>
                    <button className="btn-primary" onClick={openNew}>
                        <Plus size={18} /> {activeTab === 'Outorgas' ? 'Nova Outorga' : 'Nova Licença'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-white/[0.04] rounded-full p-1 w-fit">
                {(['Licenças', 'Outorgas'] as const).map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setSelected(null); setSelectedOutorga(null); setEditing(false) }}
                        className={activeTab === tab ? 'pill-tab-active' : 'pill-tab'}>
                        {tab === 'Outorgas' ? <><Droplets size={13} /> {tab}</> : <><FileText size={13} /> {tab}</>}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input className="form-input pl-10" placeholder="Pesquisar por empresa, pasta ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {activeTab === 'Licenças' && (
                    <select className="form-select w-full sm:w-44" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Todos Tipos</option>
                        {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                <select className="form-select w-full sm:w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Todos Status</option>
                    <option value="Válida">Válida</option>
                    <option value="Vencendo">Vencendo</option>
                    <option value="Vencida">Vencida</option>
                </select>
                <select
                    className="form-select w-full sm:w-44"
                    value={filterDias ?? ''}
                    onChange={e => setFilterDias(e.target.value === '' ? null : Number(e.target.value))}
                >
                    <option value="">Todos os prazos</option>
                    <option value="60">Vence em 60 dias</option>
                    <option value="90">Vence em 90 dias</option>
                    <option value="120">Vence em 120 dias</option>
                    <option value="150">Vence em 150 dias</option>
                    <option value="180">Vence em 180 dias</option>
                </select>
            </div>

            {/* Smart Banner */}
            <SmartAlertBanner licencas={licencas} outorgas={outorgas} />

            {/* Top Pagination — visible before scrolling through cards */}
            {activeFiltered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Página {page} de {totalPages} • {activeFiltered.length} resultados</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost !h-9 !px-3 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost !h-9 !px-3 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            {activeTab === 'Licenças' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(paginatedItems as Licenca[]).map((c, i) => {
                        const status = computeStatus(c)
                        const daysRemaining = getDaysRemaining(c)
                        const inAlert = isInAlertZone(c)
                        return (
                            <div key={c.id} className={`card-hover cursor-pointer animate-slide-up ${inAlert ? 'ring-1 ring-amber-400/50' : ''}`} style={{ animationDelay: `${i * 25}ms` }} onClick={() => { setSelected(c); setEditing(false) }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10"><FileText size={14} className="text-emerald-500" /></div>
                                        <span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-[10px] font-bold tracking-wider">{c.tipo}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
                                        {inAlert && daysRemaining !== null && daysRemaining >= 0 && (
                                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Faltam {daysRemaining}d</span>
                                        )}
                                    </div>
                                </div>
                                <h4 className="font-semibold text-sm truncate mb-0.5">{c.razao_social}</h4>
                                <p className="text-[11px] text-slate-400 truncate mb-3">{c.atividade_licenciada || 'Atividade não informada'}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1"><Building2 size={11} /> {c.departamento || '—'}</span>
                                    <span className="flex items-center gap-1"><Calendar size={11} /> Validade: {formatDate(c.validade)}</span>
                                </div>
                                {(() => {
                                    const renovDate = computeRenovacaoDate(c.validade, c.tipo)
                                    if (!renovDate) return null
                                    const today = new Date(); today.setHours(0, 0, 0, 0)
                                    const renov = new Date(renovDate); renov.setHours(0, 0, 0, 0)
                                    const val = c.validade ? new Date(c.validade.split('T')[0]) : null
                                    if (val) val.setHours(0, 0, 0, 0)
                                    const licencaVencida = val ? val < today : false
                                    const isPast = !licencaVencida && renov < today
                                    return (
                                        <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${isPast ? 'text-rose-400' : 'text-sky-400'}`}>
                                            <RotateCcw size={11} />
                                            <span>Renovar em: {formatDate(renovDate)}</span>
                                            {isPast && <span className="text-[10px] font-normal opacity-70">(atrasado)</span>}
                                        </div>
                                    )
                                })()}
                                {c.pdf_url && <div className="mt-3"><PdfButton url={c.pdf_url} /></div>}
                            </div>
                        )
                    })}
                    {filteredLicencas.length === 0 && (
                        <div className="col-span-3 py-16 text-center text-slate-400">Nenhuma licença encontrada.</div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(paginatedItems as Outorga[]).map((o, i) => {
                        const status = computeStatus(o)
                        const daysRemaining = getDaysRemaining(o)
                        const inAlert = isInAlertZone(o)
                        return (
                            <div key={o.id} className={`card-hover cursor-pointer animate-slide-up ${inAlert ? 'ring-1 ring-amber-400/50' : ''}`} style={{ animationDelay: `${i * 25}ms` }} onClick={() => { setSelectedOutorga(o); setEditing(false) }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/10"><Droplets size={14} className="text-sky-500" /></div>
                                        <span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-[10px] font-bold tracking-wider truncate max-w-[120px]">{o.tipo}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
                                        {inAlert && daysRemaining !== null && daysRemaining >= 0 && (
                                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Faltam {daysRemaining}d</span>
                                        )}
                                    </div>
                                </div>
                                <h4 className="font-semibold text-sm truncate mb-0.5">{o.razao_social}</h4>
                                <p className="text-[11px] text-slate-400 truncate mb-3">{o.numero_outorga ? `Nº ${o.numero_outorga}` : 'Sem nº de outorga'}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1"><Building2 size={11} /> {o.orgao || '—'}</span>
                                    <span className="flex items-center gap-1"><Calendar size={11} /> Validade: {formatDate(o.validade)}</span>
                                </div>
                                {(() => {
                                    const renovDate = computeRenovacaoDate(o.validade, o.tipo)
                                    if (!renovDate) return null
                                    const today = new Date(); today.setHours(0, 0, 0, 0)
                                    const renov = new Date(renovDate); renov.setHours(0, 0, 0, 0)
                                    const val = o.validade ? new Date(o.validade.split('T')[0]) : null
                                    if (val) val.setHours(0, 0, 0, 0)
                                    const outorgaVencida = val ? val < today : false
                                    const isPast = !outorgaVencida && renov < today
                                    return (
                                        <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${isPast ? 'text-rose-400' : 'text-sky-400'}`}>
                                            <RotateCcw size={11} />
                                            <span>Renovar em: {formatDate(renovDate)}</span>
                                            {isPast && <span className="text-[10px] font-normal opacity-70">(atrasado)</span>}
                                        </div>
                                    )
                                })()}
                                {o.pdf_url && <div className="mt-3"><PdfButton url={o.pdf_url} /></div>}
                            </div>
                        )
                    })}
                    {filteredOutorgas.length === 0 && (
                        <div className="col-span-3 py-16 text-center text-slate-400">Nenhuma outorga cadastrada.</div>
                    )}
                </div>
            )}

            {activeFiltered.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/[0.04]">
                    <span className="text-xs text-slate-400">Página {page} de {totalPages || 1} • Total: {activeFiltered.length}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost !h-9 !px-3 disabled:opacity-30"><ChevronLeft size={14} /> Anterior</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost !h-9 !px-3 disabled:opacity-30">Próxima <ChevronRight size={14} /></button>
                    </div>
                </div>
            )}

            {/* PDF Modal */}
            {pdfModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPdfModal(null)}>
                    <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPdfModal(null)} className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-black/10 hover:bg-black/20 transition-colors">
                            <X size={18} />
                        </button>
                        <iframe src={pdfModal} className="w-full h-full" title="PDF Viewer" />
                    </div>
                </div>
            )}

            {/* Detail Slide-over: Licença */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] border-l border-slate-100 dark:border-white/[0.06] shadow-2xl h-full overflow-y-auto animate-slide-in-left" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.06] p-6 z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-500 mb-1"><FileText size={16} /><span className="text-xs font-bold uppercase tracking-widest">{selected.tipo}</span></div>
                                    <h2 className="text-lg font-bold truncate">{selected.razao_social}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!editing && <button onClick={() => openEdit(selected)} className="p-2 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"><Edit2 size={18} /></button>}
                                    <button onClick={() => handleDelete(selected.id, 'licenca')} className="p-2 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                    <button onClick={() => setSelected(null)} className="p-2 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"><X size={20} /></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className={`badge ${statusBadgeClass(computeStatus(selected))}`}>{computeStatus(selected)}</span>
                                {selected.pdf_url && <PdfButton url={selected.pdf_url} />}
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {editing ? (
                                <div className="space-y-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Razão Social</label><input className="form-input" list="clientes-list-edit" value={form.razao_social || ''} onChange={e => setForm((f: any) => ({ ...f, razao_social: e.target.value }))} /></div>
                                    <datalist id="clientes-list-edit">{clientes.map((c, i) => <option key={i} value={c.razao_social} />)}</datalist>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                                            <select className="form-select" value={form.tipo || ''} onChange={e => handleTipoChange(e.target.value)}>
                                                {TIPOS_LICENCA.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
                                            <select className="form-select" value={form.status || ''} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                                                <option value="Válida">Válida</option><option value="Vencida">Vencida</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Atividade Licenciada</label><input className="form-input" value={form.atividade_licenciada || ''} onChange={e => setForm((f: any) => ({ ...f, atividade_licenciada: e.target.value }))} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Órgão</label><input className="form-input" value={form.departamento || ''} onChange={e => setForm((f: any) => ({ ...f, departamento: e.target.value }))} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Validade</label><input type="date" className="form-input" value={form.validade || ''} onChange={e => handleValidadeChange(e.target.value)} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de Renovação <span className="text-emerald-500 font-normal">(auto)</span></label>
                                            <input type="date" className="form-input" value={form.data_renovacao || ''} onChange={e => setForm((f: any) => ({ ...f, data_renovacao: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><Paperclip size={12} className="text-indigo-500" /> Importar documento</label>
                                            <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc" className="hidden" onChange={handleImport} />
                                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors disabled:opacity-50">
                                                {importing ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Paperclip size={14} className="text-indigo-500" />}
                                                {importing ? 'Extraindo dados...' : importedFileName ? <span className="truncate text-emerald-600 dark:text-emerald-400">{importedFileName}</span> : form.pdf_url ? 'Substituir arquivo' : 'Clique para importar PDF, Excel ou Word'}
                                            </button>
                                            {form.pdf_url && <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline mt-1 flex items-center gap-1"><ExternalLink size={10} /> Ver arquivo atual</a>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5 block"><ClipboardList size={12} className="text-amber-500" /> Data RIAA</label>
                                        <input type="date" className="form-input" value={form.data_riaa || ''} onChange={e => setForm((f: any) => ({ ...f, data_riaa: e.target.value }))} />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
                                        <button className="btn-primary" onClick={handleUpdate}><Save size={16} /> Salvar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Pasta" value={selected.pasta} />
                                        <DetailField label="Processo" value={selected.processo} />
                                        <DetailField label="CNPJ" value={selected.cnpj} />
                                        <DetailField label="Ano" value={selected.ano} />
                                        <DetailField label="Cidade" value={selected.cidade} />
                                        <DetailField label="Bairro" value={selected.bairro} />
                                        <DetailField label="Órgão" value={selected.departamento} />
                                        <DetailField label="Validade" value={formatDate(selected.validade)} />
                                        <DetailField label="Renovar em" value={formatDate(selected.data_renovacao || computeRenovacaoDate(selected.validade, selected.tipo))} />
                                    </div>
                                    {/* RIAA Date Field */}
                                    <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ClipboardList size={13} className="text-amber-500" />
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">RIAA</p>
                                        </div>
                                        <p className="text-sm font-semibold">{selected.data_riaa ? formatDate(selected.data_riaa) : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Atividade Licenciada</p>
                                        <p className="text-sm font-medium">{selected.atividade_licenciada || '—'}</p>
                                    </div>
                                    <DetailField label="Grupo" value={selected.grupo} />
                                    {(() => {
                                        const cli = clientes.find(cl => cl.cnpj && selected.cnpj && cl.cnpj === selected.cnpj)
                                        if (!cli) return null
                                        const hasContact = cli.celular || cli.email || cli.cep || cli.logradouro
                                        if (!hasContact) return null
                                        return (
                                            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Contato (via cadastro do cliente)</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {cli.celular && <DetailField label="Celular" value={cli.celular} />}
                                                    {cli.email && <DetailField label="E-mail" value={cli.email} />}
                                                    {cli.cep && <DetailField label="CEP" value={cli.cep} />}
                                                    {cli.logradouro && <DetailField label="Logradouro" value={[cli.logradouro, cli.numero, cli.complemento].filter(Boolean).join(', ')} />}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Slide-over: Outorga */}
            {selectedOutorga && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedOutorga(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] border-l border-slate-100 dark:border-white/[0.06] shadow-2xl h-full overflow-y-auto animate-slide-in-left" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.06] p-6 z-10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-sky-500 mb-1"><Droplets size={16} /><span className="text-xs font-bold uppercase tracking-widest">Outorga</span></div>
                                    <h2 className="text-lg font-bold truncate">{selectedOutorga.razao_social}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!editing && <button onClick={() => openEdit(selectedOutorga)} className="p-2 rounded-2xl hover:bg-sky-50 dark:hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 transition-colors"><Edit2 size={18} /></button>}
                                    <button onClick={() => handleDelete(selectedOutorga.id, 'outorga')} className="p-2 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                    <button onClick={() => setSelectedOutorga(null)} className="p-2 rounded-2xl hover:bg-sky-50 dark:hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 transition-colors"><X size={20} /></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className={`badge ${statusBadgeClass(computeStatus(selectedOutorga))}`}>{computeStatus(selectedOutorga)}</span>
                                {selectedOutorga.pdf_url && <PdfButton url={selectedOutorga.pdf_url} />}
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {editing ? (
                                <div className="space-y-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Razão Social</label>
                                        <input className="form-input" list="clientes-list-edit-o" value={form.razao_social || ''} onChange={e => setForm((f: any) => ({ ...f, razao_social: e.target.value }))} />
                                        <datalist id="clientes-list-edit-o">{clientes.map((c, i) => <option key={i} value={c.razao_social} />)}</datalist>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                                            <select className="form-select" value={form.tipo || ''} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}>
                                                {TIPOS_OUTORGA.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Nº Outorga</label><input className="form-input" value={form.numero_outorga || ''} onChange={e => setForm((f: any) => ({ ...f, numero_outorga: e.target.value }))} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Órgão</label><input className="form-input" value={form.orgao || ''} onChange={e => setForm((f: any) => ({ ...f, orgao: e.target.value }))} /></div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">CNPJ {cnpjLoading && <Loader2 size={10} className="animate-spin text-indigo-500" />}</label>
                                            <input className="form-input" placeholder="00.000.000/0000-00" value={form.cnpj || ''} onChange={e => handleCnpjChange(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Validade</label><input type="date" className="form-input" value={form.validade || ''} onChange={e => setForm((f: any) => ({ ...f, validade: e.target.value }))} /></div>
                                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Data de Renovação</label><input type="date" className="form-input" value={form.data_renovacao || ''} onChange={e => setForm((f: any) => ({ ...f, data_renovacao: e.target.value }))} /></div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><ClipboardList size={12} className="text-amber-500" /> Data RIAA/RAL</label>
                                        <input type="date" className="form-input" value={form.data_riaa || ''} onChange={e => setForm((f: any) => ({ ...f, data_riaa: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><Paperclip size={12} className="text-indigo-500" /> Importar documento</label>
                                        <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc" className="hidden" onChange={handleImport} />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors disabled:opacity-50">
                                            {importing ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Paperclip size={14} className="text-indigo-500" />}
                                            {importing ? 'Extraindo dados...' : importedFileName ? <span className="truncate text-emerald-600 dark:text-emerald-400">{importedFileName}</span> : form.pdf_url ? 'Substituir arquivo' : 'Clique para importar PDF, Excel ou Word'}
                                        </button>
                                        {form.pdf_url && <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline mt-1 flex items-center gap-1"><ExternalLink size={10} /> Ver arquivo atual</a>}
                                    </div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Notas</label><textarea className="form-input resize-none" rows={2} value={form.notas || ''} onChange={e => setForm((f: any) => ({ ...f, notas: e.target.value }))} /></div>
                                    <div className="flex gap-3 pt-4">
                                        <button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
                                        <button className="btn-primary" onClick={handleUpdate}><Save size={16} /> Salvar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Tipo" value={selectedOutorga.tipo} />
                                        <DetailField label="Nº Outorga" value={selectedOutorga.numero_outorga} />
                                        <DetailField label="Órgão" value={selectedOutorga.orgao} />
                                        <DetailField label="CNPJ" value={selectedOutorga.cnpj} />
                                        <DetailField label="Validade" value={formatDate(selectedOutorga.validade)} />
                                        <DetailField label="Renovar em" value={formatDate(selectedOutorga.data_renovacao || computeRenovacaoDate(selectedOutorga.validade, selectedOutorga.tipo))} />
                                        <DetailField label="Status" value={computeStatus(selectedOutorga)} />
                                        <DetailField label="Data de Renovação" value={formatDate(selectedOutorga.data_renovacao)} />
                                    </div>
                                    {/* RIAA/RAL Date Field */}
                                    <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ClipboardList size={13} className="text-amber-500" />
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">RIAA/RAL</p>
                                        </div>
                                        <p className="text-sm font-semibold">{selectedOutorga.data_riaa ? formatDate(selectedOutorga.data_riaa) : '—'}</p>
                                    </div>
                                    {selectedOutorga.notas && (
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Notas</p>
                                            <p className="text-sm">{selectedOutorga.notas}</p>
                                        </div>
                                    )}
                                    {(() => {
                                        const cli = clientes.find(cl => cl.cnpj && selectedOutorga.cnpj && cl.cnpj === selectedOutorga.cnpj)
                                        if (!cli) return null
                                        const hasContact = cli.celular || cli.email || cli.cep || cli.logradouro
                                        if (!hasContact) return null
                                        return (
                                            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Contato (via cadastro do cliente)</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {cli.celular && <DetailField label="Celular" value={cli.celular} />}
                                                    {cli.email && <DetailField label="E-mail" value={cli.email} />}
                                                    {cli.cep && <DetailField label="CEP" value={cli.cep} />}
                                                    {cli.logradouro && <DetailField label="Logradouro" value={[cli.logradouro, cli.numero, cli.complemento].filter(Boolean).join(', ')} />}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Nova Licença / Outorga */}
            {showNew && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
                    <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-white/[0.06] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-extrabold mb-6">{activeTab === 'Outorgas' ? 'Nova Outorga' : 'Nova Licença'}</h2>
                        {activeTab === 'Licenças' ? (
                            <div className="space-y-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Cliente / Razão Social *</label>
                                    <input className="form-input" list="clientes-list" placeholder="Nome da empresa" value={form.razao_social || ''} onChange={e => setForm((f: any) => ({ ...f, razao_social: e.target.value }))} />
                                    <datalist id="clientes-list">{clientes.map((c, i) => <option key={i} value={c.razao_social} />)}</datalist>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                                        <select className="form-select" value={form.tipo || 'LO'} onChange={e => handleTipoChange(e.target.value)}>
                                            {TIPOS_LICENCA.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Validade</label><input type="date" className="form-input" value={form.validade || ''} onChange={e => handleValidadeChange(e.target.value)} /></div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de Renovação <span className="text-emerald-500 font-normal">(preenchida automaticamente)</span></label>
                                    <input type="date" className="form-input" value={form.data_renovacao || ''} onChange={e => setForm((f: any) => ({ ...f, data_renovacao: e.target.value }))} />
                                </div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Atividade Licenciada</label><input className="form-input" value={form.atividade_licenciada || ''} onChange={e => setForm((f: any) => ({ ...f, atividade_licenciada: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Órgão</label><input className="form-input" value={form.departamento || ''} onChange={e => setForm((f: any) => ({ ...f, departamento: e.target.value }))} /></div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><Paperclip size={12} className="text-indigo-500" /> Importar documento</label>
                                    <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc" className="hidden" onChange={handleImport} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors disabled:opacity-50">
                                        {importing ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Paperclip size={14} className="text-indigo-500" />}
                                        {importing ? 'Extraindo dados...' : importedFileName ? <span className="truncate text-emerald-600 dark:text-emerald-400">{importedFileName}</span> : 'Clique para importar PDF, Excel ou Word'}
                                    </button>
                                    {form.pdf_url && <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline mt-1 flex items-center gap-1"><ExternalLink size={10} /> Ver arquivo enviado</a>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><ClipboardList size={12} className="text-amber-500" /> Data RIAA/RAL</label>
                                    <input type="date" className="form-input" value={form.data_riaa || ''} onChange={e => setForm((f: any) => ({ ...f, data_riaa: e.target.value }))} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Razão Social *</label>
                                    <input className="form-input" list="clientes-list2" placeholder="Nome da empresa" value={form.razao_social || ''} onChange={e => setForm((f: any) => ({ ...f, razao_social: e.target.value }))} />
                                    <datalist id="clientes-list2">{clientes.map((c, i) => <option key={i} value={c.razao_social} />)}</datalist>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                                        <select className="form-select" value={form.tipo || 'Captação Superficial'} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}>
                                            {TIPOS_OUTORGA.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Nº Outorga</label><input className="form-input" value={form.numero_outorga || ''} onChange={e => setForm((f: any) => ({ ...f, numero_outorga: e.target.value }))} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Órgão</label><input className="form-input" placeholder="ANA, SEMAS..." value={form.orgao || ''} onChange={e => setForm((f: any) => ({ ...f, orgao: e.target.value }))} /></div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">CNPJ {cnpjLoading && <Loader2 size={10} className="animate-spin text-indigo-500" />}</label>
                                        <input className="form-input" placeholder="00.000.000/0000-00" value={form.cnpj || ''} onChange={e => handleCnpjChange(e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Validade</label><input type="date" className="form-input" value={form.validade || ''} onChange={e => setForm((f: any) => ({ ...f, validade: e.target.value }))} /></div>
                                    <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Data de Renovação</label><input type="date" className="form-input" value={form.data_renovacao || ''} onChange={e => setForm((f: any) => ({ ...f, data_renovacao: e.target.value }))} /></div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><Paperclip size={12} className="text-indigo-500" /> Importar documento</label>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors disabled:opacity-50">
                                        {importing ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Paperclip size={14} className="text-indigo-500" />}
                                        {importing ? 'Extraindo dados...' : importedFileName ? <span className="truncate text-emerald-600 dark:text-emerald-400">{importedFileName}</span> : 'Clique para importar PDF, Excel ou Word'}
                                    </button>
                                    {form.pdf_url && <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline mt-1 flex items-center gap-1"><ExternalLink size={10} /> Ver arquivo enviado</a>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5"><ClipboardList size={12} className="text-amber-500" /> Data RIAA/RAL</label>
                                    <input type="date" className="form-input" value={form.data_riaa || ''} onChange={e => setForm((f: any) => ({ ...f, data_riaa: e.target.value }))} />
                                </div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Notas</label><textarea className="form-input resize-none" rows={2} value={form.notas || ''} onChange={e => setForm((f: any) => ({ ...f, notas: e.target.value }))} /></div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
                            <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveNew}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
