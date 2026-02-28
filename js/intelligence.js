// =============================================
// intelligence.js — Motor de Inteligência Relacional
// Cruza dados entre tabelas, detecta anomalias,
// gera insights preditivos e alertas inteligentes
// =============================================

window.EcoIntelligence = {

    // ==========================================
    // ANÁLISE COMPLETA DO SISTEMA
    // ==========================================
    async analiseCompleta() {
        const clientes = await EcoBackend.getClientes();
        const licencas = await EcoBackend.getLicencas();
        const financeiro = await EcoBackend.getFinanceiro();
        const kanban = await EcoBackend.getKanban();

        return {
            saude: this._calcularSaudeSistema(clientes, licencas, financeiro),
            alertas: this._gerarAlertas(clientes, licencas, financeiro),
            insights: this._gerarInsights(clientes, licencas, financeiro, kanban),
            anomalias: this._detectarAnomalias(clientes, licencas, financeiro),
            previsoes: this._gerarPrevisoes(licencas, financeiro),
            relacoes: this._mapearRelacoes(clientes, licencas, financeiro),
            riscos: this._avaliarRiscos(clientes, licencas, financeiro),
            oportunidades: this._identificarOportunidades(clientes, licencas, financeiro),
        };
    },

    // ==========================================
    // SAÚDE DO SISTEMA (Score 0-100)
    // ==========================================
    _calcularSaudeSistema(clientes, licencas, financeiro) {
        let score = 100;
        const fatores = [];

        // Fator 1: % de licenças vigentes
        const vigentes = licencas.filter(l => l.status === 'vigente').length;
        const pctVigentes = (vigentes / Math.max(licencas.length, 1)) * 100;
        if (pctVigentes < 50) {
            score -= 25;
            fatores.push({ tipo: 'critico', msg: `Apenas ${pctVigentes.toFixed(0)}% das licenças estão vigentes` });
        } else if (pctVigentes < 70) {
            score -= 10;
            fatores.push({ tipo: 'atencao', msg: `${pctVigentes.toFixed(0)}% das licenças vigentes — abaixo do ideal (>80%)` });
        }

        // Fator 2: Licenças vencidas
        const vencidas = licencas.filter(l => l.status === 'vencida').length;
        if (vencidas > 0) {
            score -= vencidas * 10;
            fatores.push({ tipo: 'critico', msg: `${vencidas} licença(s) vencida(s) — risco de multa e embargo` });
        }

        // Fator 3: Saldo financeiro
        const receita = financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
        const despesa = financeiro.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);
        const saldo = receita - despesa;
        if (saldo < 0) {
            score -= 15;
            fatores.push({ tipo: 'critico', msg: `Saldo negativo: ${EcoBackend.formatCurrency(saldo)}` });
        }

        // Fator 4: Pagamentos atrasados
        const atrasados = financeiro.filter(f => f.status === 'atrasado');
        if (atrasados.length > 0) {
            score -= atrasados.length * 5;
            const totalAtrasado = atrasados.reduce((s, f) => s + f.valor, 0);
            fatores.push({ tipo: 'atencao', msg: `${atrasados.length} pagamento(s) atrasado(s): ${EcoBackend.formatCurrency(totalAtrasado)}` });
        }

        // Fator 5: Clientes inativos
        const inativos = clientes.filter(c => c.status === 'inativo').length;
        if (inativos > clientes.length * 0.3) {
            score -= 5;
            fatores.push({ tipo: 'info', msg: `${inativos} clientes inativos — considere reativação ou limpeza` });
        }

        // Fator 6: Licenças em exigência
        const exigencia = licencas.filter(l => l.status === 'exigencia').length;
        if (exigencia > 0) {
            score -= exigencia * 5;
            fatores.push({ tipo: 'atencao', msg: `${exigencia} licença(s) em exigência — ação necessária do cliente` });
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            nivel: score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Atenção' : 'Crítico',
            cor: score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#f87171',
            fatores
        };
    },

    // ==========================================
    // ALERTAS INTELIGENTES
    // ==========================================
    _gerarAlertas(clientes, licencas, financeiro) {
        const alertas = [];
        const hoje = new Date();

        // Alerta 1: Licenças vencendo em 15, 30, 60, 90 dias
        [15, 30, 60, 90].forEach(dias => {
            const limite = new Date(hoje.getTime() + dias * 24 * 60 * 60 * 1000);
            const vencendo = licencas.filter(l => {
                const venc = new Date(l.vencimento);
                return l.status === 'vigente' && venc >= hoje && venc <= limite;
            });

            if (vencendo.length > 0) {
                vencendo.forEach(l => {
                    const cliente = clientes.find(c => c.id === l.cliente_id);
                    const diasRestantes = EcoBackend.getDaysUntil(l.vencimento);
                    alertas.push({
                        nivel: diasRestantes <= 15 ? 'critico' : diasRestantes <= 30 ? 'alto' : 'medio',
                        tipo: 'vencimento',
                        titulo: `${l.titulo} vence em ${diasRestantes} dias`,
                        descricao: `Cliente: ${cliente?.nome || 'N/A'} | Órgão: ${l.orgao} | Processo: ${l.processo}`,
                        valor_impacto: l.valor_taxa || 0,
                        acao_sugerida: diasRestantes <= 15
                            ? 'Protocolar renovação URGENTE'
                            : `Preparar documentação para renovação (prazo: ${diasRestantes}d)`,
                        entidade: { tipo: 'licenca', id: l.id }
                    });
                });
            }
        });

        // Alerta 2: Clientes sem licenças ativas
        clientes.filter(c => c.status === 'ativo').forEach(c => {
            const licencasCliente = licencas.filter(l => l.cliente_id === c.id);
            const ativas = licencasCliente.filter(l => l.status === 'vigente');
            if (licencasCliente.length > 0 && ativas.length === 0) {
                alertas.push({
                    nivel: 'alto',
                    tipo: 'compliance',
                    titulo: `${c.nome} — Sem licenças ativas`,
                    descricao: `Cliente ativo com ${licencasCliente.length} licença(s), porém nenhuma vigente.`,
                    valor_impacto: null,
                    acao_sugerida: 'Verificar status de renovação e contatar cliente',
                    entidade: { tipo: 'cliente', id: c.id }
                });
            }
        });

        // Alerta 3: Transações com valores fora do padrão
        const receitaMedia = financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0) / Math.max(financeiro.filter(f => f.tipo === 'receita').length, 1);
        financeiro.forEach(f => {
            if (f.tipo === 'receita' && f.valor > receitaMedia * 3) {
                alertas.push({
                    nivel: 'info',
                    tipo: 'financeiro',
                    titulo: `Transação acima da média: ${f.cliente}`,
                    descricao: `Valor: ${EcoBackend.formatCurrency(f.valor)} (média: ${EcoBackend.formatCurrency(receitaMedia)})`,
                    valor_impacto: f.valor,
                    acao_sugerida: 'Confirmar recebimento e emitir NF correspondente',
                    entidade: { tipo: 'financeiro', id: f.id }
                });
            }
        });

        // Ordenar por prioridade
        const prioridades = { critico: 0, alto: 1, medio: 2, baixo: 3, info: 4 };
        alertas.sort((a, b) => (prioridades[a.nivel] || 5) - (prioridades[b.nivel] || 5));

        return alertas;
    },

    // ==========================================
    // INSIGHTS AUTOMATIZADOS
    // ==========================================
    _gerarInsights(clientes, licencas, financeiro, kanban) {
        const insights = [];

        // Insight 1: Taxa de compliance
        const vigentes = licencas.filter(l => l.status === 'vigente').length;
        const taxaCompliance = (vigentes / Math.max(licencas.length, 1) * 100).toFixed(1);
        insights.push({
            tipo: 'compliance',
            icone: 'verified',
            titulo: `Taxa de Compliance: ${taxaCompliance}%`,
            descricao: `${vigentes} de ${licencas.length} licenças estão em conformidade`,
            tendencia: parseFloat(taxaCompliance) >= 70 ? 'positiva' : 'negativa',
        });

        // Insight 2: Receita por cliente
        const receitaPorCliente = {};
        financeiro.filter(f => f.tipo === 'receita' && f.cliente_id).forEach(f => {
            if (!receitaPorCliente[f.cliente_id]) receitaPorCliente[f.cliente_id] = 0;
            receitaPorCliente[f.cliente_id] += f.valor;
        });

        const topCliente = Object.entries(receitaPorCliente).sort((a, b) => b[1] - a[1])[0];
        if (topCliente) {
            const cliente = clientes.find(c => c.id === parseInt(topCliente[0]));
            insights.push({
                tipo: 'financeiro',
                icone: 'trending_up',
                titulo: `Maior receita: ${cliente?.nome || 'N/A'}`,
                descricao: `${EcoBackend.formatCurrency(topCliente[1])} em transações registradas`,
                tendencia: 'positiva',
            });
        }

        // Insight 3: Concentração de risco por órgão
        const porOrgao = {};
        licencas.forEach(l => {
            porOrgao[l.orgao] = (porOrgao[l.orgao] || 0) + 1;
        });
        const orgaoMaisUsado = Object.entries(porOrgao).sort((a, b) => b[1] - a[1])[0];
        if (orgaoMaisUsado) {
            const pctConcentracao = (orgaoMaisUsado[1] / licencas.length * 100).toFixed(0);
            insights.push({
                tipo: 'risco',
                icone: 'balance',
                titulo: `${pctConcentracao}% das licenças em ${orgaoMaisUsado[0]}`,
                descricao: `Concentração elevada em um órgão. Diversificar reduz risco operacional.`,
                tendencia: parseFloat(pctConcentracao) > 50 ? 'negativa' : 'neutra',
            });
        }

        // Insight 4: Pipeline do Kanban
        const totalKanban = Object.values(kanban).reduce((s, col) => s + (col?.length || 0), 0);
        const emExigencia = kanban.exigencia?.length || 0;
        if (totalKanban > 0) {
            insights.push({
                tipo: 'operacional',
                icone: 'view_kanban',
                titulo: `${totalKanban} processos no pipeline`,
                descricao: emExigencia > 0
                    ? `${emExigencia} em exigência — necessitam resposta prioritária`
                    : 'Todos os processos fluem normalmente',
                tendencia: emExigencia > 0 ? 'negativa' : 'positiva',
            });
        }

        // Insight 5: Licenças por cliente (média)
        const mediaLicPorCliente = licencas.length / Math.max(clientes.filter(c => c.status === 'ativo').length, 1);
        insights.push({
            tipo: 'negocio',
            icone: 'analytics',
            titulo: `Média: ${mediaLicPorCliente.toFixed(1)} licenças/cliente`,
            descricao: mediaLicPorCliente < 2
                ? 'Oportunidade de cross-selling de serviços adicionais'
                : 'Boa cobertura de serviços por cliente',
            tendencia: mediaLicPorCliente >= 2 ? 'positiva' : 'neutra',
        });

        // Insight 6: Valor total de taxas pendentes
        const taxasPendentes = licencas.filter(l => l.status === 'renovando' || l.status === 'exigencia')
            .reduce((s, l) => s + (l.valor_taxa || 0), 0);
        if (taxasPendentes > 0) {
            insights.push({
                tipo: 'financeiro',
                icone: 'payments',
                titulo: `${EcoBackend.formatCurrency(taxasPendentes)} em taxas de renovação`,
                descricao: 'Valor estimado para processos em andamento',
                tendencia: 'neutra',
            });
        }

        return insights;
    },

    // ==========================================
    // DETECÇÃO DE ANOMALIAS
    // ==========================================
    _detectarAnomalias(clientes, licencas, financeiro) {
        const anomalias = [];

        // Anomalia 1: Cliente ativo sem nenhuma licença
        clientes.filter(c => c.status === 'ativo').forEach(c => {
            const temLicenca = licencas.some(l => l.cliente_id === c.id);
            if (!temLicenca) {
                anomalias.push({
                    tipo: 'relacional',
                    severidade: 'media',
                    titulo: `Cliente sem licenças: ${c.nome}`,
                    descricao: `Cliente ativo cadastrado sem nenhuma licença vinculada.`,
                    acao: 'Verificar se existem licenças não cadastradas ou se o cliente realmente necessita.',
                    entidades: [{ tipo: 'cliente', id: c.id, nome: c.nome }]
                });
            }
        });

        // Anomalia 2: Licença vinculada a cliente inexistente
        licencas.forEach(l => {
            const clienteExiste = clientes.find(c => c.id === l.cliente_id);
            if (!clienteExiste) {
                anomalias.push({
                    tipo: 'integridade',
                    severidade: 'alta',
                    titulo: `Licença órfã: ${l.titulo}`,
                    descricao: `Licença referencia cliente_id=${l.cliente_id} que não existe na base.`,
                    acao: 'Vincular ao cliente correto ou remover licença.',
                    entidades: [{ tipo: 'licenca', id: l.id, nome: l.titulo }]
                });
            }
        });

        // Anomalia 3: Cliente inativo com licenças vigentes
        clientes.filter(c => c.status === 'inativo').forEach(c => {
            const licencasVigentes = licencas.filter(l => l.cliente_id === c.id && l.status === 'vigente');
            if (licencasVigentes.length > 0) {
                anomalias.push({
                    tipo: 'relacional',
                    severidade: 'media',
                    titulo: `Cliente inativo com licenças ativas: ${c.nome}`,
                    descricao: `${licencasVigentes.length} licença(s) vigente(s) vinculada(s) a cliente inativo.`,
                    acao: 'Reativar cliente ou transferir licenças.',
                    entidades: [
                        { tipo: 'cliente', id: c.id, nome: c.nome },
                        ...licencasVigentes.map(l => ({ tipo: 'licenca', id: l.id, nome: l.titulo }))
                    ]
                });
            }
        });

        // Anomalia 4: Duplicidade potencial de clientes
        for (let i = 0; i < clientes.length; i++) {
            for (let j = i + 1; j < clientes.length; j++) {
                const sim = this._calcularSimilaridade(clientes[i].nome, clientes[j].nome);
                if (sim > 0.7) {
                    anomalias.push({
                        tipo: 'duplicidade',
                        severidade: 'baixa',
                        titulo: `Possível duplicidade de cliente`,
                        descricao: `"${clientes[i].nome}" e "${clientes[j].nome}" (${(sim * 100).toFixed(0)}% similar)`,
                        acao: 'Verificar e unificar cadastros se necessário.',
                        entidades: [
                            { tipo: 'cliente', id: clientes[i].id, nome: clientes[i].nome },
                            { tipo: 'cliente', id: clientes[j].id, nome: clientes[j].nome },
                        ]
                    });
                }
            }
        }

        // Anomalia 5: Transação sem cliente vinculado
        financeiro.filter(f => f.tipo === 'receita' && !f.cliente_id).forEach(f => {
            anomalias.push({
                tipo: 'integridade',
                severidade: 'baixa',
                titulo: `Receita sem cliente vinculado`,
                descricao: `${f.cliente} — ${EcoBackend.formatCurrency(f.valor)}. Sem ID de cliente na base.`,
                acao: 'Vincular à ficha do cliente para relatórios corretos.',
                entidades: [{ tipo: 'financeiro', id: f.id, nome: f.cliente }]
            });
        });

        return anomalias;
    },

    // ==========================================
    // PREVISÕES
    // ==========================================
    _gerarPrevisoes(licencas, financeiro) {
        const previsoes = [];
        const hoje = new Date();

        // Previsão 1: Custos de renovação nos próximos 90 dias
        const lic90d = licencas.filter(l => {
            const venc = new Date(l.vencimento);
            const limite = new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000);
            return venc >= hoje && venc <= limite;
        });
        const custoRenovacao = lic90d.reduce((s, l) => s + (l.valor_taxa || 0), 0);
        previsoes.push({
            tipo: 'financeiro',
            titulo: 'Custos de renovação (90 dias)',
            valor: custoRenovacao,
            descricao: `${lic90d.length} licenças a renovar. Provisionamento sugerido: ${EcoBackend.formatCurrency(custoRenovacao)}`,
            confianca: 'alta'
        });

        // Previsão 2: Tendência de receita
        const receitaMeses = {};
        financeiro.filter(f => f.tipo === 'receita').forEach(f => {
            const mes = f.data.substring(0, 7);
            receitaMeses[mes] = (receitaMeses[mes] || 0) + f.valor;
        });
        const mesesOrdenados = Object.entries(receitaMeses).sort((a, b) => a[0].localeCompare(b[0]));
        if (mesesOrdenados.length >= 2) {
            const ultimo = mesesOrdenados[mesesOrdenados.length - 1][1];
            const penultimo = mesesOrdenados[mesesOrdenados.length - 2]?.[1] || ultimo;
            const tendencia = ((ultimo - penultimo) / Math.max(penultimo, 1) * 100).toFixed(1);
            previsoes.push({
                tipo: 'tendencia',
                titulo: 'Tendência de receita mensal',
                valor: parseFloat(tendencia),
                descricao: `${tendencia > 0 ? '+' : ''}${tendencia}% comparado ao mês anterior`,
                confianca: 'media'
            });
        }

        // Previsão 3: Carga operacional prevista
        const renovando = licencas.filter(l => l.status === 'renovando').length;
        const exigencia = licencas.filter(l => l.status === 'exigencia').length;
        previsoes.push({
            tipo: 'operacional',
            titulo: 'Carga de trabalho pendente',
            valor: renovando + exigencia,
            descricao: `${renovando} em renovação + ${exigencia} em exigência = ${renovando + exigencia} processos ativos`,
            confianca: 'alta'
        });

        return previsoes;
    },

    // ==========================================
    // MAPA DE RELAÇÕES
    // ==========================================
    _mapearRelacoes(clientes, licencas, financeiro) {
        return clientes.map(c => {
            const lics = licencas.filter(l => l.cliente_id === c.id);
            const fin = financeiro.filter(f => f.cliente_id === c.id);
            const receita = fin.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
            const despesa = fin.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);

            const orgaos = [...new Set(lics.map(l => l.orgao))];
            const statusLicencas = {};
            lics.forEach(l => { statusLicencas[l.status] = (statusLicencas[l.status] || 0) + 1; });

            return {
                cliente: { id: c.id, nome: c.nome, status: c.status, cidade: c.cidade, tipo: c.tipo },
                licencas: {
                    total: lics.length,
                    porStatus: statusLicencas,
                    orgaos,
                    proximoVencimento: lics.length > 0
                        ? lics.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0].vencimento
                        : null,
                },
                financeiro: {
                    receita,
                    despesa,
                    saldo: receita - despesa,
                    transacoes: fin.length,
                },
                indicadores: {
                    compliance: lics.length > 0
                        ? (lics.filter(l => l.status === 'vigente').length / lics.length * 100).toFixed(0) + '%'
                        : 'N/A',
                    riscoVencimento: lics.some(l => {
                        const dias = EcoBackend.getDaysUntil(l.vencimento);
                        return dias >= 0 && dias <= 30;
                    }),
                    lucratividade: receita > 0 ? ((receita - despesa) / receita * 100).toFixed(1) + '%' : 'N/A',
                }
            };
        });
    },

    // ==========================================
    // AVALIAÇÃO DE RISCOS
    // ==========================================
    _avaliarRiscos(clientes, licencas, financeiro) {
        const riscos = [];

        // Risco 1: Concentração de receita
        const receitaPorCliente = {};
        const totalReceita = financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
        financeiro.filter(f => f.tipo === 'receita' && f.cliente_id).forEach(f => {
            receitaPorCliente[f.cliente_id] = (receitaPorCliente[f.cliente_id] || 0) + f.valor;
        });

        Object.entries(receitaPorCliente).forEach(([clienteId, valor]) => {
            const pct = (valor / Math.max(totalReceita, 1)) * 100;
            if (pct > 40) {
                const cliente = clientes.find(c => c.id === parseInt(clienteId));
                riscos.push({
                    tipo: 'concentracao',
                    nivel: pct > 60 ? 'alto' : 'medio',
                    titulo: `Concentração de receita: ${cliente?.nome || 'N/A'}`,
                    descricao: `${pct.toFixed(0)}% da receita total vem de um único cliente.`,
                    mitigacao: 'Diversificar carteira de clientes para reduzir dependência.'
                });
            }
        });

        // Risco 2: Operação com licença vencida
        licencas.filter(l => l.status === 'vencida').forEach(l => {
            const cliente = clientes.find(c => c.id === l.cliente_id);
            riscos.push({
                tipo: 'legal',
                nivel: 'critico',
                titulo: `Operação sem licença: ${l.titulo}`,
                descricao: `${cliente?.nome || 'N/A'} pode estar operando com licença vencida. Risco de multa, embargo e responsabilidade civil/criminal.`,
                mitigacao: 'Protocolar renovação imediatamente e notificar o cliente.'
            });
        });

        // Risco 3: Dependência de um único órgão
        const porOrgao = {};
        licencas.forEach(l => { porOrgao[l.orgao] = (porOrgao[l.orgao] || 0) + 1; });
        Object.entries(porOrgao).forEach(([orgao, count]) => {
            const pct = (count / licencas.length) * 100;
            if (pct > 50) {
                riscos.push({
                    tipo: 'operacional',
                    nivel: 'medio',
                    titulo: `Concentração em ${orgao}: ${pct.toFixed(0)}% dos processos`,
                    descricao: 'Mudanças regulatórias neste órgão afetariam a maioria dos processos.',
                    mitigacao: 'Monitorar mudanças regulatórias e diversificar portfólio.'
                });
            }
        });

        return riscos;
    },

    // ==========================================
    // IDENTIFICAR OPORTUNIDADES
    // ==========================================
    _identificarOportunidades(clientes, licencas, financeiro) {
        const oportunidades = [];

        // Op 1: Clientes ativos sem serviço recente
        const financRecente = financeiro.filter(f => {
            const data = new Date(f.data);
            const tresMesesAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            return data >= tresMesesAtras;
        });
        const clientesComTransacao = new Set(financRecente.map(f => f.cliente_id).filter(Boolean));

        clientes.filter(c => c.status === 'ativo' && !clientesComTransacao.has(c.id)).forEach(c => {
            oportunidades.push({
                tipo: 'reativacao',
                titulo: `Reativar contato: ${c.nome}`,
                descricao: 'Cliente ativo sem transações nos últimos 90 dias.',
                valor_potencial: null,
                acao: `Verificar necessidades de renovação e oferecer novos serviços.`
            });
        });

        // Op 2: Upselling de certificações
        const clientesComISO = licencas.filter(l => l.tipo === 'ISO').map(l => l.cliente_id);
        clientes.filter(c => c.status === 'ativo' && !clientesComISO.includes(c.id) && c.tipo !== 'Construção').forEach(c => {
            oportunidades.push({
                tipo: 'upselling',
                titulo: `Oferecer ISO 14001: ${c.nome}`,
                descricao: 'Cliente sem certificação ambiental. Oportunidade de cross-sell.',
                valor_potencial: 8000,
                acao: 'Apresentar proposta de preparação para certificação.'
            });
        });

        // Op 3: Renovações em lote
        const renovando = licencas.filter(l => l.status === 'renovando');
        if (renovando.length >= 2) {
            const orgaosRenovando = {};
            renovando.forEach(l => {
                orgaosRenovando[l.orgao] = (orgaosRenovando[l.orgao] || 0) + 1;
            });
            Object.entries(orgaosRenovando).forEach(([orgao, count]) => {
                if (count >= 2) {
                    oportunidades.push({
                        tipo: 'eficiencia',
                        titulo: `Lote de renovação: ${count} processos no ${orgao}`,
                        descricao: 'Agrupar renovações no mesmo órgão pode reduzir custos e prazos.',
                        valor_potencial: null,
                        acao: 'Protocolar processos agrupados para otimizar taxas.'
                    });
                }
            });
        }

        return oportunidades;
    },

    // ==========================================
    // GERAR DICAS CONTEXTUAIS PARA AI BANNER
    // ==========================================
    async gerarDicasContextuais() {
        const analise = await this.analiseCompleta();
        const dicas = [];

        // Dicas baseadas em alertas
        if (analise.alertas.length > 0) {
            const criticos = analise.alertas.filter(a => a.nivel === 'critico');
            if (criticos.length > 0) {
                dicas.push(`🚨 ${criticos.length} alerta(s) crítico(s): ${criticos[0].titulo}`);
            }
        }

        // Dicas baseadas em saúde
        if (analise.saude.score < 60) {
            dicas.push(`⚠️ Saúde do sistema: ${analise.saude.score}/100 (${analise.saude.nivel}). ${analise.saude.fatores[0]?.msg || ''}`);
        }

        // Dicas baseadas em oportunidades
        analise.oportunidades.forEach(op => {
            if (op.tipo === 'eficiencia') {
                dicas.push(`💡 ${op.titulo}: ${op.descricao}`);
            }
        });

        // Dicas baseadas em insights
        analise.insights.forEach(insight => {
            if (insight.tendencia === 'negativa') {
                dicas.push(`📊 ${insight.titulo}: ${insight.descricao}`);
            }
        });

        // Dicas baseadas em previsões
        analise.previsoes.forEach(prev => {
            if (prev.tipo === 'financeiro' && prev.valor > 0) {
                dicas.push(`💰 ${prev.titulo}: ${prev.descricao}`);
            }
        });

        // Sempre ter pelo menos uma dica positiva
        if (analise.saude.score >= 80) {
            dicas.push(`✅ Sistema em excelente estado! Score: ${analise.saude.score}/100. Continue monitorando.`);
        }

        return dicas.length > 0 ? dicas : ['📋 Todos os processos estão em dia. Revise o Kanban para próximas ações.'];
    },

    // ==========================================
    // HELPERS
    // ==========================================
    _calcularSimilaridade(str1, str2) {
        const a = str1.toLowerCase().trim();
        const b = str2.toLowerCase().trim();
        if (a === b) return 1;

        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1;

        // Levenshtein-based similarity
        const costs = [];
        for (let i = 0; i <= shorter.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= longer.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[longer.length] = lastValue;
        }

        return (longer.length - costs[longer.length]) / longer.length;
    }
};
