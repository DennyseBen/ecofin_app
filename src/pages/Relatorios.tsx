import { useState, useMemo } from 'react'
import { Search, Download, FileText, Calendar, Building2, AlertCircle, Printer } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { fetchLicencas, fetchOutorgas, fetchClientes } from '../lib/api'
import type { Licenca, Outorga } from '../lib/types'

const formatDate = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
}

type PrazoOption = '30' | '60' | '120' | '180'

interface RelatorioItem {
    id: number
    tipo: 'Licença' | 'Outorga'
    razao_social: string
    cnpj: string | null
    tipo_documento: string
    validade: string | null
    data_renovacao: string | null
    dias_restantes: number
    processo?: string | null
    numero_outorga?: string | null
}

export default function Relatorios() {
    const [search, setSearch] = useState('')
    const [prazo, setPrazo] = useState<PrazoOption>('60')

    const { data: licencas, loading: loadingLic } = useSupabase(fetchLicencas, [])
    const { data: outorgas, loading: loadingOut } = useSupabase(fetchOutorgas, [])
    const { data: clientes } = useSupabase(fetchClientes, [])

    const loading = loadingLic || loadingOut

    const prazoConfig = {
        '30': { label: 'Urgente', dias: 30 },
        '60': { label: 'Curto prazo', dias: 60 },
        '120': { label: 'Médio prazo', dias: 120 },
        '180': { label: 'Longo prazo', dias: 180 }
    }

    // Processar TODOS os itens com data_renovacao (até 180 dias) — usado para contagens e PDF
    const allItems = useMemo((): RelatorioItem[] => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const result: RelatorioItem[] = []

        licencas.forEach(lic => {
            if (!lic.data_renovacao) return
            const refDate = new Date(lic.data_renovacao)
            refDate.setHours(0, 0, 0, 0)
            const diasRestantes = Math.floor((refDate.getTime() - today.getTime()) / 86400000)
            if (diasRestantes >= 0 && diasRestantes <= 180) {
                result.push({
                    id: lic.id, tipo: 'Licença', razao_social: lic.razao_social,
                    cnpj: lic.cnpj, tipo_documento: lic.tipo, validade: lic.validade,
                    data_renovacao: lic.data_renovacao, dias_restantes: diasRestantes,
                    processo: lic.processo
                })
            }
        })

        outorgas.forEach(out => {
            if (!out.data_renovacao) return
            const refDate = new Date(out.data_renovacao)
            refDate.setHours(0, 0, 0, 0)
            const diasRestantes = Math.floor((refDate.getTime() - today.getTime()) / 86400000)
            if (diasRestantes >= 0 && diasRestantes <= 180) {
                result.push({
                    id: out.id, tipo: 'Outorga', razao_social: out.razao_social,
                    cnpj: out.cnpj, tipo_documento: out.tipo, validade: out.validade,
                    data_renovacao: out.data_renovacao, dias_restantes: diasRestantes,
                    numero_outorga: out.numero_outorga
                })
            }
        })

        return result.sort((a, b) => a.dias_restantes - b.dias_restantes)
    }, [licencas, outorgas])

    // Contagem por prazo (cumulativo: 0 a N dias)
    const prazoCounts = useMemo(() => {
        const counts: Record<PrazoOption, number> = { '30': 0, '60': 0, '120': 0, '180': 0 }
        for (const key of Object.keys(counts) as PrazoOption[]) {
            const limit = prazoConfig[key].dias
            counts[key] = allItems.filter(i => i.dias_restantes <= limit).length
        }
        return counts
    }, [allItems])

    // Itens filtrados pelo prazo selecionado (tela)
    const items = useMemo((): RelatorioItem[] => {
        const limit = prazoConfig[prazo].dias
        return allItems.filter(i => i.dias_restantes <= limit)
    }, [allItems, prazo])

    // Filtrar por busca (razão social ou CNPJ)
    const filtered = useMemo(() => {
        if (!search) return items
        const s = search.toLowerCase()
        const sCnpj = s.replace(/\D/g, '')
        return items.filter(item =>
            item.razao_social.toLowerCase().includes(s) ||
            (item.cnpj && item.cnpj.toLowerCase().includes(s)) ||
            (sCnpj.length > 0 && (item.cnpj || '').replace(/\D/g, '').includes(sCnpj))
        )
    }, [items, search])

    const generatePDF = async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ])

        const doc = new jsPDF('landscape')

        // Header
        doc.setFillColor(16, 185, 129)
        doc.rect(0, 0, 297, 35, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(20)
        doc.setFont('helvetica', 'bold')
        doc.text('EcoFin Manager', 15, 15)

        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.text('Relatório de Renovações — Todos os prazos (até 180 dias)', 15, 24)

        doc.setFontSize(9)
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 30)
        doc.text(`Total de alertas: ${allItems.length}`, 230, 30)

        // Tabela — exporta TODOS os itens (0-180 dias)
        const tableData = allItems.map(item => [
            item.tipo,
            item.razao_social,
            item.cnpj || '—',
            item.tipo_documento,
            item.processo || item.numero_outorga || '—',
            formatDate(item.data_renovacao),
            formatDate(item.validade),
            item.dias_restantes.toString()
        ])

        autoTable(doc, {
            head: [['Tipo', 'Razão Social', 'CNPJ', 'Documento', 'Processo/Nº', 'Renovação', 'Validade', 'Dias']],
            body: tableData,
            startY: 45,
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 58 },
                2: { cellWidth: 30 },
                3: { cellWidth: 35 },
                4: { cellWidth: 30 },
                5: { cellWidth: 24 },
                6: { cellWidth: 24 },
                7: { cellWidth: 16, halign: 'center' }
            }
        })

        doc.save(`relatorio_renovacoes_180dias_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    const handlePrint = () => {
        window.print()
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
                        Acompanhamento de licenças e outorgas por prazo de renovação
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-3xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Busca */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Buscar (Razão Social ou CNPJ)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Digite razão social ou CNPJ..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* Prazo */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Filtrar por prazo
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(prazoConfig) as PrazoOption[]).map(key => (
                                <button
                                    key={key}
                                    onClick={() => setPrazo(key)}
                                    className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                                        prazo === key
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <div>{prazoConfig[key].dias} dias</div>
                                    <div className="text-[10px] opacity-80">{prazoConfig[key].label}</div>
                                    <div className={`text-[10px] mt-1 font-semibold ${prazo === key ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {prazoCounts[key]} {prazoCounts[key] === 1 ? 'alerta' : 'alertas'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats */}
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
                        <p className="text-xs mt-1">Altere o prazo ou a busca para ver resultados</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Razão Social</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">CNPJ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Documento</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Processo/Nº</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Renovação</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Validade</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Dias p/ Renovação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item, idx) => (
                                    <tr
                                        key={`${item.tipo}-${item.id}`}
                                        className={`border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                                            idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.01]' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                item.tipo === 'Licença'
                                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                                    : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                                            }`}>
                                                {item.tipo === 'Licença' ? <FileText size={12} /> : <Building2 size={12} />}
                                                {item.tipo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium">{item.razao_social}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.cnpj || '—'}</td>
                                        <td className="px-4 py-3 text-sm">{item.tipo_documento}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {item.processo || item.numero_outorga || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar size={14} className="text-amber-500" />
                                                <span className="font-semibold text-amber-700 dark:text-amber-400">
                                                    {formatDate(item.data_renovacao)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDate(item.validade)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                item.dias_restantes <= 30
                                                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                                    : item.dias_restantes <= 60
                                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                    : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                                            }`}>
                                                {item.dias_restantes} {item.dias_restantes === 1 ? 'dia' : 'dias'}
                                            </span>
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
