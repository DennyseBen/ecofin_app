import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Download, RefreshCw, FileText, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, BarChart3, Users, DollarSign, Calendar as CalIcon, Send, Loader2 as Loader, AlertTriangle, ExternalLink, Ban } from 'lucide-react'
import { useSupabase } from '../hooks/useSupabase'
import { fetchContratos, fetchFaturas, insertContrato, updateContrato, deleteContrato, gerarFaturasEmLote, updateFaturaStatus, fetchClientes, emitirNfseFatura, consultarNfseFatura, cancelarNfseFatura, emitirLoteNfse, fetchConfigNfse } from '../lib/api'
import type { ContratoMensal, FaturaNfe, Cliente, NfseStatus } from '../lib/types'
import { isNfseConfigurado, getAmbiente } from '../lib/focusnfe'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Utils
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
const formatCompetencia = (comp: string) => { const [y, m] = comp.split('-'); return `${m}/${y}` }

// ─── NFS-e helpers ────────────────────────────────────────────────────────────

function NfseStatusBadge({ status }: { status: NfseStatus }) {
    const map: Record<NfseStatus, { label: string; cls: string }> = {
        nao_emitida:              { label: 'Não emitida',    cls: 'badge-slate' },
        aguardando_processamento: { label: 'Processando…',  cls: 'badge-yellow' },
        autorizado:               { label: 'Autorizada',    cls: 'badge-green' },
        erro:                     { label: 'Erro',          cls: 'badge-red' },
        cancelado:                { label: 'Cancelada',     cls: 'badge-red' },
    }
    const { label, cls } = map[status] ?? map.nao_emitida
    return <span className={`badge ${cls}`}>{label}</span>
}

export default function Financas() {
    const [activeTab, setActiveTab] = useState<'geral' | 'contratos' | 'faturas' | 'nfse'>('geral')

    const { data: contratos, loading: loadingContratos, refetch: refetchContratos } = useSupabase(fetchContratos, [])
    const { data: faturas, loading: loadingFaturas, refetch: refetchFaturas } = useSupabase(fetchFaturas, [])
    const { data: clientes } = useSupabase(fetchClientes, [])
    const { data: configNfse } = useSupabase(fetchConfigNfse, null)

    // Contrato State
    const [showContratoModal, setShowContratoModal] = useState(false)
    const [formC, setFormC] = useState({ cliente_id: 0, valor: '', dia_vencimento: '10', descricao: '' })

    // Batch Generate State
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const [loteCompetencia, setLoteCompetencia] = useState(currentMonth)
    const [isGenerating, setIsGenerating] = useState(false)

    // NFS-e State
    const [nfseCompetencia, setNfseCompetencia] = useState(currentMonth)
    const [nfseLoadingId, setNfseLoadingId] = useState<number | null>(null)
    const [nfseLoteLoading, setNfseLoteLoading] = useState(false)
    const nfseAtivo = isNfseConfigurado(configNfse?.focusnfe_token)
    const ambiente = getAmbiente(configNfse?.focusnfe_ambiente)

    // NFS-e preview modal
    const [nfsePreview, setNfsePreview] = useState<FaturaNfe | null>(null)
    const [nfsePreviewDiscriminacao, setNfsePreviewDiscriminacao] = useState('')

    const fetchAll = () => { refetchContratos(); refetchFaturas() }

    // NFS-e handlers
    const handleEmitirUnitario = (fatura: FaturaNfe) => {
        const cliente = (fatura as any).cliente
        const [ano, mes] = fatura.competencia.split('-')
        const competenciaFmt = `${mes}/${ano}`
        const discriminacaoPadrao = (configNfse?.discriminacao_padrao || 'Assessoria Ambiental - Referente à competência {competencia}').replace('{competencia}', competenciaFmt)
        const discriminacaoInicial = fatura.notas ? `${discriminacaoPadrao}\n${fatura.notas}` : discriminacaoPadrao
        setNfsePreviewDiscriminacao(discriminacaoInicial)
        setNfsePreview(fatura)
    }

    const handleConfirmarEmissao = async () => {
        if (!nfsePreview) return
        setNfseLoadingId(nfsePreview.id)
        setNfsePreview(null)
        try {
            await emitirNfseFatura(nfsePreview.id, nfsePreviewDiscriminacao)
            refetchFaturas()
        } catch (e: any) {
            alert(`Erro ao emitir NFS-e: ${e.message}`)
        } finally {
            setNfseLoadingId(null)
        }
    }

    const handleConsultar = async (faturaId: number) => {
        setNfseLoadingId(faturaId)
        try {
            await consultarNfseFatura(faturaId)
            refetchFaturas()
        } catch (e: any) {
            alert(`Erro ao consultar: ${e.message}`)
        } finally {
            setNfseLoadingId(null)
        }
    }

    const handleCancelar = async (faturaId: number) => {
        const just = prompt('Informe a justificativa do cancelamento (mín. 15 caracteres):')
        if (!just || just.length < 15) return alert('Justificativa muito curta.')
        setNfseLoadingId(faturaId)
        try {
            await cancelarNfseFatura(faturaId, just)
            refetchFaturas()
        } catch (e: any) {
            alert(`Erro ao cancelar: ${e.message}`)
        } finally {
            setNfseLoadingId(null)
        }
    }

    const handleEmitirLote = async () => {
        const faturasLote = faturas.filter(f =>
            f.competencia === nfseCompetencia &&
            (f.nfse_status === 'nao_emitida' || f.nfse_status === 'erro' || !f.nfse_status)
        )
        if (!faturasLote.length) return alert('Nenhuma fatura pendente de emissão para esta competência.')
        if (!confirm(`Emitir ${faturasLote.length} NFS-e(s) para a competência ${nfseCompetencia.split('-').reverse().join('/')}?`)) return
        setNfseLoteLoading(true)
        try {
            const { ok, erro } = await emitirLoteNfse(nfseCompetencia)
            alert(`Lote concluído!\n✅ ${ok} emitidas\n❌ ${erro} com erro`)
            refetchFaturas()
        } catch (e: any) {
            alert(`Erro no lote: ${e.message}`)
        } finally {
            setNfseLoteLoading(false)
        }
    }

    // Handlers Contrato
    const handleSaveContrato = async () => {
        if (!formC.cliente_id || !formC.valor || !formC.dia_vencimento) return alert('Preencha os campos obrigatórios')
        try {
            await insertContrato({
                cliente_id: Number(formC.cliente_id),
                valor: Number(formC.valor.replace(',', '.')),
                dia_vencimento: Number(formC.dia_vencimento),
                descricao: formC.descricao,
                ativo: true
            })
            setShowContratoModal(false)
            refetchContratos()
        } catch (e: any) { alert(e.message || 'Erro') }
    }

    const toggleContrato = async (c: ContratoMensal) => {
        await updateContrato(c.id, { ativo: !c.ativo })
        refetchContratos()
    }

    const handleDeleteContrato = async (id: number) => {
        if (confirm("Excluir este contrato perfeitamente?")) {
            await deleteContrato(id)
            refetchContratos()
        }
    }

    // Lotes
    const handleGerarLote = async () => {
        const ativ = contratos.filter(c => c.ativo).length
        if (ativ === 0) return alert('Nenhum contrato ativo para gerar faturas.')
        if (!confirm(`Gerar ${ativ} faturas automáticas para a competência ${formatCompetencia(loteCompetencia)}?`)) return

        setIsGenerating(true)
        try {
            const count = await gerarFaturasEmLote(loteCompetencia)
            alert(`Sucesso! ${count} faturas geradas.`)
            fetchAll()
        } catch (e: any) { alert(e.message || 'Erro ao gerar') }
        finally { setIsGenerating(false) }
    }

    // PDF Generator
    const generatePDF = (fatura: FaturaNfe) => {
        const doc = new jsPDF()
        const clienteRecord = clientes.find(c => c.id === fatura.cliente_id)

        // Colors
        const primaryColor = '#10b981' // emerald-500

        // Header
        doc.setFillColor(16, 185, 129) // Emerald
        doc.rect(0, 0, 210, 40, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(24)
        doc.setFont('helvetica', 'bold')
        doc.text('EcoFin Manager', 15, 25)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Fatura / Invoice de Serviço', 15, 32)

        doc.setFontSize(14)
        doc.text(`FATURA #${fatura.id}`, 160, 25)
        doc.setFontSize(10)
        doc.text(`Vencimento: ${fatura.data_vencimento.split('-').reverse().join('/')}`, 160, 32)

        // Meta
        doc.setTextColor(50, 50, 50)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Cobrança Para:', 15, 60)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Razão Social: ${clienteRecord?.razao_social || 'Desconhecida'}`, 15, 68)
        doc.text(`CNPJ: ${clienteRecord?.cnpj || '—'}`, 15, 74)
        doc.text(`Endereço: ${clienteRecord?.cidade || ''} - ${clienteRecord?.bairro || ''}`, 15, 80)
        doc.text(`Contato: ${clienteRecord?.email || ''} / ${clienteRecord?.celular || ''}`, 15, 86)

        doc.setFont('helvetica', 'bold')
        doc.text('Dados de Faturamento:', 120, 60)
        doc.setFont('helvetica', 'normal')
        doc.text(`Competência: ${formatCompetencia(fatura.competencia)}`, 120, 68)
        doc.text(`Situação: ${fatura.status.toUpperCase()}`, 120, 74)
        doc.text(`Emissão: ${new Date(fatura.data_emissao).toLocaleDateString('pt-BR')}`, 120, 80)

        // Services Table
        autoTable(doc, {
            startY: 100,
            head: [['Descrição do Serviço (Referência Mensal / Processos)', 'Valor Unit. (R$)', 'Total (R$)']],
            body: [
                [fatura.notas || 'Assessoria Ambiental e Processos Mensais', formatCurrency(fatura.valor_total), formatCurrency(fatura.valor_total)]
            ],
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] },
        })

        const finalY = (doc as any).lastAutoTable?.finalY ?? 130

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(`Total a Pagar:`, 130, finalY + 15)
        doc.setTextColor(16, 185, 129)
        doc.text(formatCurrency(fatura.valor_total), 170, finalY + 15)

        // Save
        doc.save(`Fatura_EcoFin_${formatCompetencia(fatura.competencia).replace('/', '-')}_${clienteRecord?.razao_social.slice(0, 10)}.pdf`)
    }

    const { chartData, revenue, prevRevenue, pendingRevenue } = useMemo(() => {
        let rev = 0, pRev = 0, currPend = 0
        const map = new Map<string, number>() // yyyy-mm -> total value

        faturas.forEach(f => {
            if (f.status === 'pago') {
                rev += Number(f.valor_total)
                const c = f.competencia
                map.set(c, (map.get(c) || 0) + Number(f.valor_total))
            } else if (f.status === 'pendente') {
                currPend += Number(f.valor_total)
            }
        })

        const cData = Array.from(map.entries())
            .map(([comp, total]) => ({ name: formatCompetencia(comp), total }))
            .sort((a, b) => a.name.localeCompare(b.name))

        return { chartData: cData, revenue: rev, prevRevenue: pRev, pendingRevenue: currPend }
    }, [faturas])

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pago': return 'badge-green'
            case 'pendente': return 'badge-yellow'
            case 'cancelado': return 'badge-red'
            default: return 'badge-blue'
        }
    }

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Finanças Inteligentes</h1>
                    <p className="text-slate-400 text-sm">Geração de Boletos, Lotes e Impressões em PDF</p>
                </div>
                <div className="flex bg-slate-100/50 dark:bg-white/[0.02] p-1 rounded-2xl w-full sm:w-auto">
                    {(['geral', 'contratos', 'faturas', 'nfse'] as const).map(tab => (
                        <button key={tab} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === tab ? 'bg-white dark:bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'geral' ? 'Visão Geral' : tab === 'contratos' ? 'Contratos' : tab === 'faturas' ? 'Faturas' : 'NFS-e'}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB: VISÃO GERAL */}
            {activeTab === 'geral' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="card shadow-sm border-0 border-l-4 border-l-emerald-500">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-50 dark:bg-emerald-500/[0.04] rounded-xl"><DollarSign size={20} className="text-emerald-500" /></div><h3 className="text-sm font-semibold text-slate-500">Receita Total Recebida</h3></div>
                            <p className="text-2xl font-black">{formatCurrency(revenue)}</p>
                        </div>
                        <div className="card shadow-sm border-0 border-l-4 border-l-yellow-500">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-yellow-50 dark:bg-yellow-500/[0.04] rounded-xl"><Clock size={20} className="text-yellow-500" /></div><h3 className="text-sm font-semibold text-slate-500">Total a Receber (Pendente)</h3></div>
                            <p className="text-2xl font-black">{formatCurrency(pendingRevenue)}</p>
                        </div>
                        <div className="card shadow-sm border-0 border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-50 dark:bg-blue-500/[0.04] rounded-xl"><FileText size={20} className="text-blue-500" /></div><h3 className="text-sm font-semibold text-slate-500">Total de Contratos Ativos</h3></div>
                            <p className="text-2xl font-black">{contratos.filter(c => c.ativo).length} Contratos</p>
                            <p className="text-xs text-slate-400 mt-1">Renderização no Lote</p>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-6"><BarChart3 size={16} className="text-emerald-500" /> Faturamento por Competência (Recebidos)</h3>
                        <div className="h-72">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `R$${val / 1000}k`} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => formatCurrency(val)} />
                                        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#10b981' : '#34d399'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full flex flex-col items-center justify-center text-slate-400"><BarChart3 size={40} className="mb-2 opacity-20" /><p>Sem dados suficientes</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CONTRATOS & LOTE */}
            {activeTab === 'contratos' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="card bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-indigo-500/10 dark:to-emerald-500/10 border-0 shadow-lg">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><RefreshCw size={20} className="text-emerald-500" /> Emissor de Lote Inteligente</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Gere automaticamente dezenas de Faturas para todos os contratos ativos no mês.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <input type="month" className="form-input flex-1 sm:w-40" value={loteCompetencia} onChange={e => setLoteCompetencia(e.target.value)} />
                                <button className="btn-primary w-full sm:w-auto" disabled={isGenerating} onClick={handleGerarLote}>
                                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : 'Disparar Lote'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-slate-400" /> Gerenciamento de Contratos Activos ({contratos.length})</h3>
                        <button className="btn-secondary text-xs" onClick={() => setShowContratoModal(true)}><Plus size={14} /> Novo Contrato</button>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.04]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500">Cliente</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500">Vencimento</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500">Valor Mensal</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {loadingContratos ? <tr><td colSpan={5} className="py-8 text-center text-slate-400">Carregando...</td></tr> :
                                    contratos.map(c => (
                                        <tr key={c.id} className="border-b border-slate-50 dark:border-white/[0.02] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.01]">
                                            <td className="px-6 py-4 font-medium">{(c as any).cliente?.razao_social || 'Desconhecido'}</td>
                                            <td className="px-6 py-4 text-slate-400">Dia {c.dia_vencimento}</td>
                                            <td className="px-6 py-4 font-medium text-emerald-500">{formatCurrency(c.valor)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`badge ${c.ativo ? 'badge-green' : 'badge-slate'}`}>{c.ativo ? 'Ativo' : 'Pausado'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-xs font-semibold text-blue-500 hover:underline mr-4" onClick={() => toggleContrato(c)}>{c.ativo ? 'Pausar' : 'Reativar'}</button>
                                                <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => handleDeleteContrato(c.id)}>Excluir</button>
                                            </td>
                                        </tr>
                                    ))}
                                {contratos.length === 0 && !loadingContratos && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhum contrato criado.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: FATURAS E PDF */}
            {activeTab === 'faturas' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2"><FileText size={16} /> Central de Faturas Gerdas</h3>
                            <button className="p-2 bg-white dark:bg-[#0d1a14] shadow-sm rounded-lg" onClick={() => refetchFaturas()}><RefreshCw size={14} className="text-slate-400" /></button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500">Nº Fatura / Comp.</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500">Cliente</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500">Vencimento</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500">Total</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500">Situação</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 text-right">Impressão</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {loadingFaturas ? <tr><td colSpan={6} className="py-8 text-center text-slate-400">Carregando faturas...</td></tr> :
                                        faturas.map(f => (
                                            <tr key={f.id} className="border-b border-slate-50 dark:border-white/[0.02] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.01]">
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-xs text-slate-400">#{f.id.toString().padStart(4, '0')}</div>
                                                    <div className="font-semibold text-xs mt-1">{formatCompetencia(f.competencia)}</div>
                                                </td>
                                                <td className="px-6 py-4 font-medium truncate max-w-[200px]">{(f as any).cliente?.razao_social || 'Desconhecido'}</td>
                                                <td className="px-6 py-4 text-slate-500 text-xs flex items-center gap-1.5 mt-2"><CalIcon size={12} /> {f.data_vencimento.split('-').reverse().join('/')}</td>
                                                <td className="px-6 py-4 font-bold">{formatCurrency(f.valor_total)}</td>
                                                <td className="px-6 py-4">
                                                    <select className={`text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer border-0 ${getStatusStyle(f.status)}`}
                                                        value={f.status} onChange={(e) => { updateFaturaStatus(f.id, e.target.value as any); refetchFaturas(); }}>
                                                        <option value="pendente">Pendente</option>
                                                        <option value="pago">Foi Pago</option>
                                                        <option value="cancelado">Cancelado</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="flex items-center justify-end gap-1.5 text-xs font-bold text-emerald-500 hover:underline ml-auto" onClick={() => generatePDF(f)}><Download size={14} /> PDF</button>
                                                </td>
                                            </tr>
                                        ))}
                                    {faturas.length === 0 && !loadingFaturas && <tr><td colSpan={6} className="py-12 text-center text-slate-400">Nenhuma fatura encontrada. Crie um lote primeiro.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: NFS-e */}
            {activeTab === 'nfse' && (
                <div className="space-y-6 animate-slide-up">

                    {/* Aviso de ambiente / token */}
                    {!nfseAtivo && (
                        <div className="card border border-yellow-300 bg-yellow-50 dark:bg-yellow-500/10 flex items-start gap-3">
                            <AlertTriangle size={20} className="text-yellow-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-yellow-800 dark:text-yellow-300">Token Focus NF-e não configurado</p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                    Acesse <strong>Configurações → NFS-e</strong> e informe o token de acesso da sua conta Focus NF-e para habilitar a emissão.
                                </p>
                            </div>
                        </div>
                    )}

                    {nfseAtivo && ambiente === 'homologacao' && (
                        <div className="card border border-blue-200 bg-blue-50 dark:bg-blue-500/10 flex items-center gap-3 py-3">
                            <AlertTriangle size={16} className="text-blue-400 shrink-0" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                Ambiente: <strong>Homologação</strong> — notas não têm validade fiscal. Altere para <strong>Produção</strong> em <em>Configurações → NFS-e</em> quando estiver pronto.
                            </p>
                        </div>
                    )}

                    {/* Emissor em lote */}
                    <div className="card bg-gradient-to-br from-violet-50 to-emerald-50 dark:from-violet-500/10 dark:to-emerald-500/10 border-0 shadow-lg">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Send size={20} className="text-violet-500" /> Emissor de NFS-e em Lote</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Emite automaticamente todas as NFS-e pendentes da competência selecionada.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <input type="month" className="form-input flex-1 sm:w-40" value={nfseCompetencia} onChange={e => setNfseCompetencia(e.target.value)} />
                                <button
                                    className="btn-primary w-full sm:w-auto flex items-center gap-2"
                                    disabled={nfseLoteLoading || !nfseAtivo}
                                    onClick={handleEmitirLote}
                                >
                                    {nfseLoteLoading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                                    Emitir Lote
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de NFS-e por competência */}
                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2"><FileText size={16} /> Notas Fiscais de Serviço</h3>
                            <button className="p-2 bg-white dark:bg-[#0d1a14] shadow-sm rounded-lg" onClick={refetchFaturas}><RefreshCw size={14} className="text-slate-400" /></button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">Fatura</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">Cliente</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">Competência</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">Valor</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">NFS-e Nº</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status NFS-e</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {loadingFaturas
                                        ? <tr><td colSpan={7} className="py-8 text-center text-slate-400">Carregando…</td></tr>
                                        : faturas.map(f => {
                                            const isLoading = nfseLoadingId === f.id
                                            const status = f.nfse_status || 'nao_emitida'
                                            const podeEmitir = status === 'nao_emitida' || status === 'erro'
                                            const podeConsultar = !!f.nfse_referencia && status !== 'nao_emitida'
                                            const podeCancelar = status === 'autorizado'

                                            return (
                                                <tr key={f.id} className="border-b border-slate-50 dark:border-white/[0.02] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.01]">
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{f.id.toString().padStart(4, '0')}</td>
                                                    <td className="px-4 py-3 font-medium truncate max-w-[160px]">{(f as any).cliente?.razao_social || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500">{formatCompetencia(f.competencia)}</td>
                                                    <td className="px-4 py-3 font-bold">{formatCurrency(f.valor_total)}</td>
                                                    <td className="px-4 py-3">
                                                        {f.nfse_numero
                                                            ? <span className="font-mono text-emerald-600 dark:text-emerald-400">{f.nfse_numero}</span>
                                                            : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <NfseStatusBadge status={status as any} />
                                                        {f.nfse_erro && <p className="text-xs text-red-400 mt-1 max-w-[180px] truncate" title={f.nfse_erro}>{f.nfse_erro}</p>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isLoading
                                                                ? <Loader size={16} className="animate-spin text-slate-400" />
                                                                : <>
                                                                    {podeEmitir && (
                                                                        <button
                                                                            className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline"
                                                                            onClick={() => handleEmitirUnitario(f)}
                                                                            disabled={!nfseAtivo}
                                                                        >
                                                                            <Send size={12} /> Emitir
                                                                        </button>
                                                                    )}
                                                                    {podeConsultar && (
                                                                        <button
                                                                            className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline"
                                                                            onClick={() => handleConsultar(f.id)}
                                                                        >
                                                                            <RefreshCw size={12} /> Atualizar
                                                                        </button>
                                                                    )}
                                                                    {f.nfse_pdf_url && (
                                                                        <a href={f.nfse_pdf_url} target="_blank" rel="noreferrer"
                                                                            className="flex items-center gap-1 text-xs font-semibold text-emerald-500 hover:underline">
                                                                            <Download size={12} /> PDF
                                                                        </a>
                                                                    )}
                                                                    {f.nfse_xml_url && (
                                                                        <a href={f.nfse_xml_url} target="_blank" rel="noreferrer"
                                                                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline">
                                                                            <ExternalLink size={12} /> XML
                                                                        </a>
                                                                    )}
                                                                    {podeCancelar && (
                                                                        <button
                                                                            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline"
                                                                            onClick={() => handleCancelar(f.id)}
                                                                        >
                                                                            <Ban size={12} /> Cancelar
                                                                        </button>
                                                                    )}
                                                                </>
                                                            }
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    }
                                    {!loadingFaturas && faturas.length === 0 && (
                                        <tr><td colSpan={7} className="py-12 text-center text-slate-400">Nenhuma fatura. Gere um lote primeiro na aba Contratos.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Novo Contrato */}
            {/* NFS-e Preview Modal */}
            {nfsePreview && (() => {
                const cliente = (nfsePreview as any).cliente
                const [ano, mes] = nfsePreview.competencia.split('-')
                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-[#0d1a14] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-100 dark:border-white/[0.06]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-xl"><Send size={18} className="text-violet-500" /></div>
                                    <div>
                                        <h2 className="text-lg font-bold">Confirmar Emissão de NFS-e</h2>
                                        <p className="text-xs text-slate-400">Fatura #{nfsePreview.id.toString().padStart(4,'0')} · Competência {mes}/{ano}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-y-auto p-6 space-y-5">
                                {/* Tomador */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tomador do Serviço</p>
                                    <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-4 space-y-1.5">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Razão Social</span>
                                            <span className="text-xs font-semibold text-right">{cliente?.razao_social || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">CNPJ / CPF</span>
                                            <span className="text-xs font-mono">{cliente?.cnpj || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">E-mail</span>
                                            <span className="text-xs">{cliente?.email || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Endereço</span>
                                            <span className="text-xs text-right">
                                                {[cliente?.logradouro, cliente?.numero, cliente?.bairro, cliente?.cidade].filter(Boolean).join(', ') || '—'}
                                                {cliente?.cep ? ` · CEP ${cliente.cep}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Serviço */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Dados do Serviço</p>
                                    <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-4 space-y-1.5">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Valor</span>
                                            <span className="text-sm font-black text-emerald-600">{formatCurrency(nfsePreview.valor_total)}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Competência</span>
                                            <span className="text-xs font-semibold">{mes}/{ano}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Código Serviço</span>
                                            <span className="text-xs font-mono">{configNfse?.codigo_servico || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-xs text-slate-400">Alíquota ISS</span>
                                            <span className="text-xs">{configNfse?.aliquota_iss ?? '—'}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Discriminação — editable */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                                        Discriminação do Serviço
                                        <span className="text-slate-400 font-normal normal-case ml-1">(editável antes de emitir)</span>
                                    </label>
                                    <textarea
                                        className="form-input resize-none text-sm"
                                        rows={4}
                                        value={nfsePreviewDiscriminacao}
                                        onChange={e => setNfsePreviewDiscriminacao(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 dark:border-white/[0.06] flex gap-3 justify-end">
                                <button className="btn-ghost" onClick={() => setNfsePreview(null)}>Cancelar</button>
                                <button className="btn-primary flex items-center gap-2" onClick={handleConfirmarEmissao}>
                                    <Send size={15} /> Emitir NFS-e
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {showContratoModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#0d1a14] rounded-3xl w-full max-w-md p-8 shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">Criar Contrato (Mensalidade)</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Vincular Cliente</label>
                                <select className="form-input" value={formC.cliente_id} onChange={e => setFormC(f => ({ ...f, cliente_id: Number(e.target.value) }))}>
                                    <option value={0}>Selecione um cliente...</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Mensal (R$)</label><input type="number" step="0.01" className="form-input" placeholder="500,00" value={formC.valor} onChange={e => setFormC(f => ({ ...f, valor: e.target.value }))} /></div>
                                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Dia de Vencimento</label><input type="number" min="1" max="31" className="form-input" value={formC.dia_vencimento} onChange={e => setFormC(f => ({ ...f, dia_vencimento: e.target.value }))} /></div>
                            </div>
                            <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição Padrão da Nfe</label><input className="form-input" placeholder="Assessoria Ambiental Recorrente" value={formC.descricao} onChange={e => setFormC(f => ({ ...f, descricao: e.target.value }))} /></div>
                        </div>
                        <div className="flex gap-3 justify-end mt-8">
                            <button className="btn-ghost" onClick={() => setShowContratoModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveContrato}>Ativar Mensalidade</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
