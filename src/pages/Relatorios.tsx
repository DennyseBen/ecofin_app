import { useState, useMemo, useCallback } from 'react'
import { Search, Download, FileText, Calendar, Building2, AlertCircle, Printer, MapPin, Droplets } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { useRealtime } from '../hooks/useRealtime'
import { fetchAlertasLicencas, fetchAlertasOutorgas, fetchOutorgas } from '../lib/api'
import { isInAlertZone, getDaysRemaining, getRenovacaoLeadDays } from '../lib/types'
import type { Licenca, Outorga } from '../lib/types'

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

/**
 * Retorna data_renovacao do banco, ou calcula: validade − leadDays do tipo.
 */
function resolveRenovacao(dataRenovacao: string | null, validade: string | null, tipo: string): string | null {
    if (dataRenovacao) return dataRenovacao
    if (!validade) return null
    const leadDays = getRenovacaoLeadDays(tipo)
    const valDate = new Date(validade)
    valDate.setDate(valDate.getDate() - leadDays)
    return valDate.toISOString().split('T')[0]
}

// ── Regras idênticas às de Notificações ──────────────────────────────────────
type RegraId = 'curto' | 'padrao' | 'outorgas'

interface Regra {
    id: RegraId
    label: string
    dias: number
    tipos: string[]
    cor: string
}

const REGRAS: Regra[] = [
    {
        id: 'curto', label: 'Curto prazo', dias: 60,
        tipos: ['ANM', 'CEPROF', 'Registro ANM', 'RIAA', 'RAL'],
        cor: 'sky',
    },
    {
        id: 'padrao', label: 'Prazo padrão', dias: 120,
        tipos: ['LO', 'LP', 'LI', 'ASV', 'AUV', 'LAR', 'Supressão', 'CLUA', 'Dispensa de Outorga', 'Licença Prefeito'],
        cor: 'amber',
    },
    {
        id: 'outorgas', label: 'Outorgas hídricas', dias: 180,
        tipos: ['OUTORGA'],
        cor: 'emerald',
    },
]

// ── Item do relatório ────────────────────────────────────────────────────────
interface RelatorioItem {
    id: number
    kind: 'licenca' | 'outorga'
    razao_social: string
    cnpj: string | null
    cidade: string | null
    orgao: string | null
    tipo_documento: string
    validade: string | null
    data_renovacao: string | null
    dias_restantes: number | null
    processo: string | null
    numero_outorga: string | null
    regra: RegraId | null
}

function classifyRegra(tipo: string, kind: 'licenca' | 'outorga'): RegraId | null {
    if (kind === 'outorga') return 'outorgas'
    const t = tipo.toUpperCase()
    for (const regra of REGRAS) {
        if (regra.tipos.some(r => t === r.toUpperCase() || t.includes(r.toUpperCase()))) {
            return regra.id
        }
    }
    return 'padrao' // default para licenças não classificadas
}

export default function Relatorios() {
    const [search, setSearch] = useState('')
    const [activeRegra, setActiveRegra] = useState<RegraId | 'todos'>('todos')

    // Mesmas APIs que Notificações usa
    const { data: licencasAlerta, loading: loadingLic, refetch: refetchLic } = useSupabase(fetchAlertasLicencas, [])
    const { data: outorgasAlerta, loading: loadingOutA, refetch: refetchOutA } = useSupabase(fetchAlertasOutorgas, [])
    const { data: outorgasFull, loading: loadingOutF, refetch: refetchOutF } = useSupabase(fetchOutorgas, [])

    const refetchAll = useCallback(() => { refetchLic(); refetchOutA(); refetchOutF() }, [refetchLic, refetchOutA, refetchOutF])
    useRealtime(['licencas', 'outorgas'], refetchAll)

    const loading = loadingLic || loadingOutA || loadingOutF

    // ── Construir itens usando isInAlertZone (mesma lógica de Notificações) ──
    const allItems = useMemo((): RelatorioItem[] => {
        const result: RelatorioItem[] = []

        // Licenças em zona de alerta (baseado em validade + tipo, como Notificações)
        for (const lic of licencasAlerta) {
            if (!isInAlertZone(lic)) continue
            result.push({
                id: lic.id,
                kind: 'licenca',
                razao_social: lic.razao_social,
                cnpj: lic.cnpj,
                cidade: lic.cidade ?? null,
                orgao: lic.departamento ?? null,
                tipo_documento: lic.tipo,
                validade: lic.validade,
                data_renovacao: resolveRenovacao(lic.data_renovacao, lic.validade, lic.tipo),
                dias_restantes: getDaysRemaining(lic),
                processo: lic.processo ?? null,
                numero_outorga: null,
                regra: classifyRegra(lic.tipo, 'licenca'),
            })
        }

        // Outorgas em zona de alerta
        for (const out of outorgasFull) {
            if (!isInAlertZone(out)) continue
            result.push({
                id: out.id,
                kind: 'outorga',
                razao_social: out.razao_social,
                cnpj: out.cnpj,
                cidade: null,
                orgao: out.orgao ?? null,
                tipo_documento: out.tipo,
                validade: out.validade,
                data_renovacao: resolveRenovacao(out.data_renovacao, out.validade, out.tipo),
                dias_restantes: getDaysRemaining(out),
                processo: null,
                numero_outorga: out.numero_outorga ?? null,
                regra: 'outorgas',
            })
        }

        return result.sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999))
    }, [licencasAlerta, outorgasFull])

    // ── Contagens por regra ──
    const regraCounts = useMemo(() => {
        const counts: Record<RegraId, number> = { curto: 0, padrao: 0, outorgas: 0 }
        for (const item of allItems) {
            if (item.regra) counts[item.regra]++
        }
        return counts
    }, [allItems])

    // ── Filtro por regra selecionada ──
    const regraFiltered = useMemo((): RelatorioItem[] => {
        if (activeRegra === 'todos') return allItems
        return allItems.filter(i => i.regra === activeRegra)
    }, [allItems, activeRegra])

    // ── Busca por razão social, CNPJ, cidade ou órgão ──
    const filtered = useMemo(() => {
        if (!search) return regraFiltered
        const s = search.toLowerCase()
        const sCnpj = s.replace(/\D/g, '')
        return regraFiltered.filter(item =>
            item.razao_social.toLowerCase().includes(s) ||
            (item.cnpj && item.cnpj.toLowerCase().includes(s)) ||
            (sCnpj.length > 0 && (item.cnpj || '').replace(/\D/g, '').includes(sCnpj)) ||
            (item.cidade && item.cidade.toLowerCase().includes(s)) ||
            (item.orgao && item.orgao.toLowerCase().includes(s))
        )
    }, [regraFiltered, search])

    const generatePDF = async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ])

        const doc = new jsPDF('landscape')
        const pageW = doc.internal.pageSize.getWidth()
        const pageH = doc.internal.pageSize.getHeight()

        const regraLabel = activeRegra === 'todos'
            ? 'Todos os alertas'
            : REGRAS.find(r => r.id === activeRegra)?.label ?? activeRegra

        // --- Header ---
        doc.setFillColor(16, 185, 129)
        doc.rect(0, 0, pageW, 42, 'F')
        doc.setFillColor(13, 148, 103)
        doc.rect(0, 38, pageW, 4, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.text('EcoFin Manager', 15, 16)

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Relatório de Renovações — ${regraLabel}`, 15, 26)

        doc.setFontSize(9)
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 34)

        // Badge total
        const totalText = `${filtered.length} alerta${filtered.length !== 1 ? 's' : ''}`
        const tw = doc.getTextWidth(totalText) + 12
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(pageW - tw - 15, 28, tw, 10, 2, 2, 'F')
        doc.setTextColor(16, 185, 129)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(totalText, pageW - tw - 15 + 6, 34.5)

        // --- Resumo por regra ---
        const summaryY = 52
        doc.setTextColor(60, 60, 60)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Resumo por Regra de Antecedência', 15, summaryY)

        const boxW = 82
        const boxH = 18
        const boxGap = 8
        const boxStartX = 15
        const boxY = summaryY + 4

        REGRAS.forEach((regra, idx) => {
            const x = boxStartX + idx * (boxW + boxGap)
            const isSelected = activeRegra === regra.id || activeRegra === 'todos'
            if (isSelected) {
                doc.setFillColor(16, 185, 129)
                doc.setTextColor(255, 255, 255)
            } else {
                doc.setFillColor(245, 245, 245)
                doc.setTextColor(80, 80, 80)
            }
            doc.roundedRect(x, boxY, boxW, boxH, 3, 3, 'F')
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text(`${regra.dias}d · ${regra.label}`, x + 4, boxY + 7)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text(`${regraCounts[regra.id]} alerta${regraCounts[regra.id] !== 1 ? 's' : ''}`, x + 4, boxY + 13)
        })

        // --- Tabela ---
        const tableData = filtered.map(item => [
            item.kind === 'licenca' ? 'Licença' : 'Outorga',
            item.razao_social,
            item.cnpj || '—',
            item.cidade || '—',
            item.tipo_documento,
            item.orgao || '—',
            item.processo || item.numero_outorga || '—',
            formatDate(item.data_renovacao),
            formatDate(item.validade),
            item.dias_restantes !== null ? `${item.dias_restantes}d` : '—'
        ])

        autoTable(doc, {
            head: [['Tipo', 'Razão Social', 'CNPJ', 'Cidade', 'Documento', 'Órgão', 'Processo/Nº', 'Renovação', 'Vencimento', 'Dias']],
            body: tableData,
            startY: boxY + boxH + 10,
            styles: { fontSize: 7, cellPadding: 2, lineColor: [230, 230, 230], lineWidth: 0.2 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 46 },
                2: { cellWidth: 28 },
                3: { cellWidth: 22 },
                4: { cellWidth: 22 },
                5: { cellWidth: 22 },
                6: { cellWidth: 24 },
                7: { cellWidth: 20 },
                8: { cellWidth: 20 },
                9: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 9) {
                    const dias = parseInt(data.cell.raw as string)
                    if (isNaN(dias)) return
                    if (dias <= 15) {
                        data.cell.styles.textColor = [220, 38, 38]
                    } else if (dias <= 45) {
                        data.cell.styles.textColor = [217, 119, 6]
                    } else {
                        data.cell.styles.textColor = [22, 163, 74]
                    }
                }
            },
        })

        // --- Rodapé ---
        const totalPages = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i)
            doc.setFillColor(245, 245, 245)
            doc.rect(0, pageH - 12, pageW, 12, 'F')
            doc.setFontSize(7.5)
            doc.setTextColor(140, 140, 140)
            doc.setFont('helvetica', 'normal')
            doc.text('EcoFin Manager — Relatório de Renovações', 15, pageH - 5)
            doc.text(`Página ${i} de ${totalPages}`, pageW - 40, pageH - 5)
        }

        const suffix = activeRegra === 'todos' ? 'todos' : activeRegra
        doc.save(`relatorio_renovacoes_${suffix}_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    const handlePrint = () => {
        window.print()
    }

    const regraCorMap: Record<string, { active: string; inactive: string; count: string }> = {
        sky: {
            active: 'bg-sky-500 text-white shadow-lg shadow-sky-500/30',
            inactive: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-500/20',
            count: 'text-sky-200',
        },
        amber: {
            active: 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
            inactive: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-500/20',
            count: 'text-amber-200',
        },
        emerald: {
            active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
            inactive: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
            count: 'text-emerald-200',
        },
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <FileText className="text-emerald-500" size={32} />
                        Relatórios
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Acompanhamento de licenças e outorgas por regra de antecedência
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Busca */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Buscar (Razão Social, CNPJ, Cidade ou Órgão)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Digite razão social, CNPJ, cidade..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* Regras de antecedência */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Filtrar por regra de antecedência
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {/* Botão "Todos" */}
                            <button
                                onClick={() => setActiveRegra('todos')}
                                className={`px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                                    activeRegra === 'todos'
                                        ? 'bg-slate-700 text-white shadow-lg shadow-slate-700/30'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}
                            >
                                <div>Todos</div>
                                <div className={`text-[10px] mt-1 font-semibold ${activeRegra === 'todos' ? 'text-slate-300' : 'text-slate-400'}`}>
                                    {allItems.length} alertas
                                </div>
                            </button>

                            {/* Botões por regra */}
                            {REGRAS.map(regra => {
                                const isActive = activeRegra === regra.id
                                const cores = regraCorMap[regra.cor]
                                return (
                                    <button
                                        key={regra.id}
                                        onClick={() => setActiveRegra(isActive ? 'todos' : regra.id)}
                                        className={`px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                                            isActive ? cores.active : cores.inactive
                                        }`}
                                    >
                                        <div>{regra.dias}d</div>
                                        <div className="text-[10px] opacity-80">{regra.label}</div>
                                        <div className={`text-[10px] mt-1 font-semibold ${isActive ? cores.count : 'text-slate-400 dark:text-slate-500'}`}>
                                            {regraCounts[regra.id]} {regraCounts[regra.id] === 1 ? 'alerta' : 'alertas'}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Stats + ações */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2 text-sm">
                        <AlertCircle size={16} className="text-amber-500" />
                        <span className="font-bold">{filtered.length}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                            {filtered.length === 1 ? 'alerta encontrado' : 'alertas encontrados'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-500 text-white font-bold text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-500/30"
                        >
                            <Printer size={16} />
                            Imprimir
                        </button>
                        <button
                            onClick={generatePDF}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30"
                        >
                            <Download size={16} />
                            Exportar PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">
                        <div className="animate-spin mx-auto w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                        <p className="mt-4 text-sm">Carregando dados...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-medium">Nenhum alerta encontrado</p>
                        <p className="text-xs mt-1">Altere a regra ou a busca para ver resultados</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Razão Social</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">CNPJ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Cidade</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Documento</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Órgão</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Processo/Nº</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Renovação</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Vencimento</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Dias p/ Venc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item, idx) => (
                                    <tr
                                        key={`${item.kind}-${item.id}`}
                                        className={`border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                                            idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.01]' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                item.kind === 'licenca'
                                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                    : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                                            }`}>
                                                {item.kind === 'licenca' ? <FileText size={12} /> : <Droplets size={12} />}
                                                {item.kind === 'licenca' ? 'Licença' : 'Outorga'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium">{item.razao_social}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">{item.cnpj || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {item.cidade ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin size={12} className="text-slate-400" />
                                                    {item.cidade}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{item.tipo_documento}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.orgao || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {item.processo || item.numero_outorga || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.data_renovacao ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Calendar size={14} className="text-sky-500" />
                                                    <span className="font-semibold text-sky-700 dark:text-sky-400">
                                                        {formatDate(item.data_renovacao)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar size={14} className="text-amber-500" />
                                                <span className="font-semibold text-amber-700 dark:text-amber-400">
                                                    {formatDate(item.validade)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {item.dias_restantes !== null ? (
                                                <span className={`inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                    item.dias_restantes <= 15
                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                                        : item.dias_restantes <= 45
                                                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                        : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                                    }`}>
                                                    {item.dias_restantes} {item.dias_restantes === 1 ? 'dia' : 'dias'}
                                                </span>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
