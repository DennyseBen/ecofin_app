// =============================================
// queries.js — Todas as queries/requests ao Supabase
// Funções CRUD completas com lógica de negócio
// =============================================

window.EcoQueries = {

    // =================== CLIENTES ===================
    clientes: {
        async listar(filtros = {}) {
            if (EcoBackend.IS_MOCK) {
                let dados = await EcoBackend.getClientes();
                if (filtros.status) dados = dados.filter(c => c.status === filtros.status);
                if (filtros.tipo) dados = dados.filter(c => c.tipo === filtros.tipo);
                if (filtros.busca) {
                    const q = filtros.busca.toLowerCase();
                    dados = dados.filter(c => c.nome.toLowerCase().includes(q) || c.cnpj.includes(q) || c.cidade.toLowerCase().includes(q));
                }
                return dados;
            }
            let query = EcoBackend.supabase.from('clientes').select('*');
            if (filtros.status) query = query.eq('status', filtros.status);
            if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
            if (filtros.busca) query = query.ilike('razao_social', `%${filtros.busca}%`);
            const { data, error } = await query.order('razao_social');
            if (error) throw error;
            return data;
        },

        async buscarPorId(id) {
            if (EcoBackend.IS_MOCK) return EcoBackend.getClienteById(id);
            const { data, error } = await EcoBackend.supabase
                .from('clientes').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async criar(cliente) {
            if (EcoBackend.IS_MOCK) {
                cliente.id = Date.now();
                cliente.criado_em = new Date().toISOString();
                return cliente;
            }
            const { data, error } = await EcoBackend.supabase
                .from('clientes').insert(cliente).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('criacao', `Cliente "${cliente.razao_social || cliente.nome}" criado`, 'cliente', data.id);
            return data;
        },

        async atualizar(id, campos) {
            if (EcoBackend.IS_MOCK) return { ...campos, id };
            campos.atualizado_em = new Date().toISOString();
            const { data, error } = await EcoBackend.supabase
                .from('clientes').update(campos).eq('id', id).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('edicao', `Cliente #${id} atualizado`, 'cliente', id);
            return data;
        },

        async excluir(id) {
            if (EcoBackend.IS_MOCK) return true;
            const { error } = await EcoBackend.supabase
                .from('clientes').delete().eq('id', id);
            if (error) throw error;
            await EcoQueries.atividades.registrar('exclusao', `Cliente #${id} removido`, 'cliente', id);
            return true;
        },

        async contarPorStatus() {
            const todos = await this.listar();
            return {
                ativo: todos.filter(c => c.status === 'ativo').length,
                pendente: todos.filter(c => c.status === 'pendente').length,
                inativo: todos.filter(c => c.status === 'inativo').length,
                total: todos.length
            };
        },

        async contarPorTipo() {
            const todos = await this.listar();
            const tipos = {};
            todos.forEach(c => {
                tipos[c.tipo] = (tipos[c.tipo] || 0) + 1;
            });
            return tipos;
        },

        // Retorna o cliente com suas licenças vinculadas
        async comLicencas(clienteId) {
            const cliente = await this.buscarPorId(clienteId);
            const licencas = await EcoQueries.licencas.listar({ cliente_id: clienteId });
            return { ...cliente, licencas };
        },

        // Retorna o cliente com seu histórico financeiro
        async comFinanceiro(clienteId) {
            const cliente = await this.buscarPorId(clienteId);
            const financeiro = await EcoQueries.financeiro.listar();
            const transacoes = Array.isArray(financeiro)
                ? financeiro.filter(f => f.cliente_id === clienteId)
                : [];
            return { ...cliente, transacoes };
        }
    },

    // =================== LICENÇAS ===================
    licencas: {
        async listar(filtros = {}) {
            if (EcoBackend.IS_MOCK) {
                let dados = await EcoBackend.getLicencas();
                if (filtros.status) dados = dados.filter(l => l.status === filtros.status);
                if (filtros.orgao) dados = dados.filter(l => l.orgao === filtros.orgao);
                if (filtros.cliente_id) dados = dados.filter(l => l.cliente_id === filtros.cliente_id);
                if (filtros.tipo) dados = dados.filter(l => l.tipo === filtros.tipo);
                return dados;
            }
            let query = EcoBackend.supabase.from('vw_licencas_completas').select('*');
            if (filtros.status) query = query.eq('status', filtros.status);
            if (filtros.orgao) query = query.eq('orgao', filtros.orgao);
            if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
            if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
            const { data, error } = await query.order('data_vencimento');
            if (error) throw error;
            return data;
        },

        async buscarPorId(id) {
            if (EcoBackend.IS_MOCK) {
                const licencas = await EcoBackend.getLicencas();
                return licencas.find(l => l.id === id);
            }
            const { data, error } = await EcoBackend.supabase
                .from('vw_licencas_completas').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async criar(licenca) {
            if (EcoBackend.IS_MOCK) {
                licenca.id = Date.now();
                return licenca;
            }
            const { data, error } = await EcoBackend.supabase
                .from('licencas').insert(licenca).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('criacao', `Licença "${licenca.titulo}" criada`, 'licenca', data.id);
            return data;
        },

        async atualizar(id, campos) {
            if (EcoBackend.IS_MOCK) return { ...campos, id };
            campos.atualizado_em = new Date().toISOString();
            const { data, error } = await EcoBackend.supabase
                .from('licencas').update(campos).eq('id', id).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('edicao', `Licença #${id} atualizada`, 'licenca', id);
            return data;
        },

        async renovar(id) {
            return this.atualizar(id, { status: 'renovando' });
        },

        async vencendoEm(dias = 30) {
            const todas = await this.listar();
            const hoje = new Date();
            const limite = new Date(hoje.getTime() + dias * 24 * 60 * 60 * 1000);
            return todas.filter(l => {
                const venc = new Date(l.vencimento || l.data_vencimento);
                return venc >= hoje && venc <= limite && l.status === 'vigente';
            });
        },

        async vencidas() {
            const todas = await this.listar();
            return todas.filter(l => l.status === 'vencida');
        },

        async porOrgao() {
            const todas = await this.listar();
            const agrupado = {};
            todas.forEach(l => {
                agrupado[l.orgao] = (agrupado[l.orgao] || 0) + 1;
            });
            return agrupado;
        },

        async porCliente(clienteId) {
            return this.listar({ cliente_id: clienteId });
        },

        // Retorna licença com dados do cliente vinculado
        async comCliente(licencaId) {
            const licenca = await this.buscarPorId(licencaId);
            if (!licenca) return null;
            const cliente = await EcoQueries.clientes.buscarPorId(licenca.cliente_id);
            return { ...licenca, cliente };
        },

        // Calcula valor total de taxas por status
        async valorTotalTaxas() {
            const todas = await this.listar();
            const porStatus = {};
            todas.forEach(l => {
                if (!porStatus[l.status]) porStatus[l.status] = 0;
                porStatus[l.status] += (l.valor_taxa || 0);
            });
            return porStatus;
        }
    },

    // =================== FINANCEIRO ===================
    financeiro: {
        async listar(filtros = {}) {
            if (EcoBackend.IS_MOCK) {
                let dados = await EcoBackend.getFinanceiro();
                if (filtros.tipo) dados = dados.filter(f => f.tipo === filtros.tipo);
                if (filtros.status) dados = dados.filter(f => f.status === filtros.status);
                if (filtros.categoria) dados = dados.filter(f => f.categoria === filtros.categoria);
                if (filtros.de) dados = dados.filter(f => f.data >= filtros.de);
                if (filtros.ate) dados = dados.filter(f => f.data <= filtros.ate);
                if (filtros.cliente_id) dados = dados.filter(f => f.cliente_id === filtros.cliente_id);
                return dados;
            }
            let query = EcoBackend.supabase.from('financeiro').select('*');
            if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
            if (filtros.status) query = query.eq('status', filtros.status);
            if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
            if (filtros.de) query = query.gte('data', filtros.de);
            if (filtros.ate) query = query.lte('data', filtros.ate);
            const { data, error } = await query.order('data', { ascending: false });
            if (error) throw error;
            return data;
        },

        async criar(transacao) {
            if (EcoBackend.IS_MOCK) {
                transacao.id = Date.now();
                return transacao;
            }
            const { data, error } = await EcoBackend.supabase
                .from('financeiro').insert(transacao).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('criacao', `Transação de ${EcoBackend.formatCurrency(transacao.valor)} registrada`, 'financeiro', data.id);
            return data;
        },

        async resumoMensal() {
            const todas = await this.listar();
            const meses = {};
            todas.forEach(t => {
                const mes = t.data.substring(0, 7);
                if (!meses[mes]) meses[mes] = { receita: 0, despesa: 0, count: 0 };
                if (t.tipo === 'receita') meses[mes].receita += t.valor;
                else meses[mes].despesa += t.valor;
                meses[mes].count++;
            });
            return meses;
        },

        async totais() {
            const todas = await this.listar();
            const receita = todas.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
            const despesa = todas.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
            const pendente = todas.filter(t => t.status === 'pendente').reduce((s, t) => s + t.valor, 0);
            const atrasado = todas.filter(t => t.status === 'atrasado').reduce((s, t) => s + t.valor, 0);
            return { receita, despesa, saldo: receita - despesa, pendente, atrasado };
        },

        async porCategoria() {
            const todas = await this.listar();
            const cats = {};
            todas.forEach(t => {
                if (!cats[t.categoria]) cats[t.categoria] = { receita: 0, despesa: 0, count: 0 };
                cats[t.categoria][t.tipo] += t.valor;
                cats[t.categoria].count++;
            });
            return cats;
        },

        // Retorna transações vinculadas a um cliente
        async porCliente(clienteId) {
            return this.listar({ cliente_id: clienteId });
        }
    },

    // =================== KANBAN ===================
    kanban: {
        async listar() {
            if (EcoBackend.IS_MOCK) return EcoBackend.getKanban();
            const { data, error } = await EcoBackend.supabase
                .from('kanban_cards').select('*, clientes(razao_social)').order('posicao');
            if (error) throw error;
            const colunas = { doc_pendente: [], em_analise: [], exigencia: [], aprovado: [] };
            data.forEach(card => {
                if (colunas[card.coluna]) colunas[card.coluna].push(card);
            });
            return colunas;
        },

        async moverCard(cardId, novaColuna, novaPosicao = 0) {
            if (EcoBackend.IS_MOCK) return true;
            const { error } = await EcoBackend.supabase
                .from('kanban_cards').update({
                    coluna: novaColuna,
                    posicao: novaPosicao,
                    atualizado_em: new Date().toISOString()
                }).eq('id', cardId);
            if (error) throw error;
            await EcoQueries.atividades.registrar('edicao', `Card #${cardId} movido para ${novaColuna}`, 'kanban', cardId);
            return true;
        },

        async criarCard(card) {
            if (EcoBackend.IS_MOCK) {
                card.id = Date.now();
                return card;
            }
            const { data, error } = await EcoBackend.supabase
                .from('kanban_cards').insert(card).select().single();
            if (error) throw error;
            return data;
        },

        // Estatísticas do Kanban
        async estatisticas() {
            const kanban = await this.listar();
            return {
                doc_pendente: kanban.doc_pendente?.length || 0,
                em_analise: kanban.em_analise?.length || 0,
                exigencia: kanban.exigencia?.length || 0,
                aprovado: kanban.aprovado?.length || 0,
                total: Object.values(kanban).reduce((s, col) => s + (col?.length || 0), 0),
            };
        }
    },

    // =================== DOCUMENTOS ===================
    documentos: {
        async listarPorLicenca(licencaId) {
            if (EcoBackend.IS_MOCK) return [];
            const { data, error } = await EcoBackend.supabase
                .from('documentos').select('*').eq('licenca_id', licencaId).order('criado_em', { ascending: false });
            if (error) throw error;
            return data;
        },

        async upload(file, licencaId, clienteId) {
            if (EcoBackend.IS_MOCK) return { nome_arquivo: file.name, id: Date.now() };
            const path = `licencas/${licencaId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await EcoBackend.supabase.storage
                .from('documentos').upload(path, file);
            if (uploadError) throw uploadError;

            const { data } = await EcoBackend.supabase.from('documentos').insert({
                nome_arquivo: file.name,
                tipo_arquivo: file.name.split('.').pop(),
                tamanho_bytes: file.size,
                storage_path: path,
                licenca_id: licencaId,
                cliente_id: clienteId
            }).select().single();
            return data;
        }
    },

    // =================== ATIVIDADES (LOG) ===================
    atividades: {
        async listar(limite = 20) {
            if (EcoBackend.IS_MOCK) {
                const mockData = [
                    { tipo: 'login', descricao: 'Sessão iniciada no sistema', criado_em: new Date().toISOString() },
                    { tipo: 'edicao', descricao: 'Licença LO #12345 renovação protocolada', criado_em: new Date(Date.now() - 3600000).toISOString() },
                    { tipo: 'upload', descricao: 'Relatório técnico enviado — Vale Verde', criado_em: new Date(Date.now() - 7200000).toISOString() },
                    { tipo: 'criacao', descricao: 'Novo cliente cadastrado: Petrogreen Energy', criado_em: new Date(Date.now() - 18000000).toISOString() },
                    { tipo: 'edicao', descricao: 'Outorga de captação atualizada — Fazendas Sustentáveis', criado_em: new Date(Date.now() - 43200000).toISOString() },
                    { tipo: 'criacao', descricao: 'Transação financeira registrada: R$ 22.000', criado_em: new Date(Date.now() - 86400000).toISOString() },
                    { tipo: 'exclusao', descricao: 'Documento antigo removido do arquivo', criado_em: new Date(Date.now() - 172800000).toISOString() },
                ];
                return mockData.slice(0, limite);
            }
            const { data, error } = await EcoBackend.supabase
                .from('atividades').select('*, perfis(nome_completo)').order('criado_em', { ascending: false }).limit(limite);
            if (error) throw error;
            return data;
        },

        async registrar(tipo, descricao, entidadeTipo = null, entidadeId = null, metadata = null) {
            if (EcoBackend.IS_MOCK) return;
            const session = await EcoBackend.checkSession();
            await EcoBackend.supabase.from('atividades').insert({
                tipo, descricao, entidade_tipo: entidadeTipo, entidade_id: entidadeId,
                usuario_id: session?.user?.id, metadata
            });
        }
    },

    // =================== BUSCA RELACIONAL (RAG-style) ===================
    busca: {
        async global(query) {
            return EcoBackend.search(query);
        },

        async sugestoes(query) {
            const resultados = await this.global(query);
            const q = query.toLowerCase();

            const tips = [];
            if (q.includes('venc')) tips.push('💡 Dica: Use filtros de data para ver licenças por período de vencimento.');
            if (q.includes('multa') || q.includes('pagar') || q.includes('atrasado')) tips.push('⚠️ Existem pagamentos pendentes que precisam de atenção imediata.');
            if (q.includes('ibama')) tips.push('📋 Processos IBAMA geralmente levam 60-90 dias úteis para análise técnica.');
            if (q.includes('cetesb')) tips.push('📋 A CETESB opera com prazos de 30-45 dias para licenças simples.');
            if (q.includes('semad')) tips.push('📋 SEMAD-MG: acompanhe via SIAM - sistema integrado de informação ambiental.');
            if (q.includes('eia') || q.includes('rima')) tips.push('📋 EIA/RIMA requer audiência pública. Prazo médio: 6-12 meses.');
            if (q.includes('iso')) tips.push('📋 Certificação ISO 14001 requer auditoria interna + externa. Ciclo: 3 anos.');
            if (resultados.length === 0) tips.push('🔍 Tente buscar por: nome de cliente, tipo de licença, órgão emissor ou status.');

            return { resultados, tips };
        }
    },

    // =================== RELATÓRIOS ===================
    relatorios: {
        // Visão 360 de um cliente
        async visaoCliente(clienteId) {
            const cliente = await EcoQueries.clientes.buscarPorId(clienteId);
            const licencas = await EcoQueries.licencas.listar({ cliente_id: clienteId });
            const financeiro = await EcoQueries.financeiro.listar({ cliente_id: clienteId });

            const hoje = new Date();
            const licencasVencendo = licencas.filter(l => {
                const venc = new Date(l.vencimento || l.data_vencimento);
                const em30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
                return venc >= hoje && venc <= em30;
            });

            const totalReceita = financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
            const totalDespesa = financeiro.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);

            return {
                cliente,
                licencas,
                licencasVencendo,
                financeiro,
                totalReceita,
                totalDespesa,
                saldo: totalReceita - totalDespesa,
                saude: licencasVencendo.length === 0 && licencas.every(l => l.status !== 'vencida') ? 'boa' : 'atenção'
            };
        },

        // Dashboard executivo
        async executivo() {
            const stats = await EcoBackend.getDashboardStats();
            const kanbanStats = await EcoQueries.kanban.estatisticas();
            const finTotais = await EcoQueries.financeiro.totais();
            const licPorOrgao = await EcoQueries.licencas.porOrgao();

            return {
                ...stats,
                kanban: kanbanStats,
                finTotais,
                licPorOrgao,
                taxa_compliance: (stats.vigentes / Math.max(stats.totalLicencas, 1) * 100).toFixed(1),
            };
        }
    },

    // =================== CONDICIONANTES ===================
    condicionantes: {
        // Listar condicionantes padrão (seed data)
        async listarPadrao() {
            if (EcoBackend.IS_MOCK) {
                // Incluir custom condicionantes salvas no localStorage
                const customStored = localStorage.getItem('ecocrm_condicionantes_custom');
                const custom = customStored ? JSON.parse(customStored) : [];
                return [...MOCK_DB.condicionantes_padrao, ...custom];
            }
            const { data, error } = await EcoBackend.supabase
                .from('condicionantes_padrao').select('*').order('descricao');
            if (error) throw error;
            return data;
        },

        // Listar condicionantes de uma licença específica (com cálculo de dias)
        async listarPorLicenca(licencaId) {
            let dados;
            if (EcoBackend.IS_MOCK) {
                dados = MOCK_DB.condicionantes_licenca.filter(c => c.licenca_id === licencaId);
            } else {
                const { data, error } = await EcoBackend.supabase
                    .from('condicionantes_licenca').select('*')
                    .eq('licenca_id', licencaId)
                    .order('prazo_vencimento');
                if (error) throw error;
                dados = data;
            }

            // Enriquecer com cálculo de dias e nível de urgência
            const hoje = new Date();
            return dados.map(c => {
                const venc = new Date(c.prazo_vencimento + 'T00:00:00');
                const diasRestantes = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
                let urgencia, urgenciaCor;

                if (c.status === 'cumprida') {
                    urgencia = 'cumprida';
                    urgenciaCor = '#4ade80';
                } else if (diasRestantes < 0) {
                    urgencia = 'atrasada';
                    urgenciaCor = '#f87171';
                } else if (diasRestantes <= 15) {
                    urgencia = 'critica';
                    urgenciaCor = '#f87171';
                } else if (diasRestantes <= 30) {
                    urgencia = 'alerta';
                    urgenciaCor = '#fbbf24';
                } else if (diasRestantes <= 60) {
                    urgencia = 'atencao';
                    urgenciaCor = '#fb923c';
                } else {
                    urgencia = 'normal';
                    urgenciaCor = '#60a5fa';
                }

                return {
                    ...c,
                    dias_restantes: diasRestantes,
                    urgencia,
                    urgencia_cor: urgenciaCor,
                    vencimento_formatado: EcoBackend.formatDate(c.prazo_vencimento),
                };
            });
        },

        // Criar condicionante vinculada a uma licença
        async criar(licencaId, condicionante) {
            const nova = {
                id: Date.now(),
                licenca_id: licencaId,
                condicionante_padrao_id: condicionante.condicionante_padrao_id || null,
                descricao: condicionante.descricao,
                prazo_vencimento: condicionante.prazo_vencimento,
                status: 'pendente',
                arquivo_url: null,
                observacao: condicionante.observacao || '',
                criado_em: new Date().toISOString().split('T')[0],
            };

            if (EcoBackend.IS_MOCK) {
                MOCK_DB.condicionantes_licenca.push(nova);
                return nova;
            }

            const { data, error } = await EcoBackend.supabase
                .from('condicionantes_licenca').insert(nova).select().single();
            if (error) throw error;
            await EcoQueries.atividades.registrar('criacao', `Condicionante "${nova.descricao}" adicionada`, 'condicionante', data.id);
            return data;
        },

        // Criar nova condicionante padrão customizada (persistente)
        async criarCustomizada(descricao, categoria = 'Personalizada') {
            const nova = {
                id: Date.now(),
                descricao,
                categoria,
                obrigatoria: false,
            };

            if (EcoBackend.IS_MOCK) {
                const customStored = localStorage.getItem('ecocrm_condicionantes_custom');
                const custom = customStored ? JSON.parse(customStored) : [];
                custom.push(nova);
                localStorage.setItem('ecocrm_condicionantes_custom', JSON.stringify(custom));
                return nova;
            }

            const { data, error } = await EcoBackend.supabase
                .from('condicionantes_padrao').insert(nova).select().single();
            if (error) throw error;
            return data;
        },

        // Atualizar condicionante
        async atualizar(id, campos) {
            if (EcoBackend.IS_MOCK) {
                const idx = MOCK_DB.condicionantes_licenca.findIndex(c => c.id === id);
                if (idx !== -1) {
                    MOCK_DB.condicionantes_licenca[idx] = { ...MOCK_DB.condicionantes_licenca[idx], ...campos };
                    return MOCK_DB.condicionantes_licenca[idx];
                }
                return null;
            }
            const { data, error } = await EcoBackend.supabase
                .from('condicionantes_licenca').update(campos).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        // Marcar como cumprida (com arquivo opcional)
        async marcarCumprida(id, arquivoUrl = null) {
            return this.atualizar(id, {
                status: 'cumprida',
                arquivo_url: arquivoUrl,
            });
        },

        // Excluir condicionante
        async excluir(id) {
            if (EcoBackend.IS_MOCK) {
                const idx = MOCK_DB.condicionantes_licenca.findIndex(c => c.id === id);
                if (idx !== -1) MOCK_DB.condicionantes_licenca.splice(idx, 1);
                return true;
            }
            const { error } = await EcoBackend.supabase
                .from('condicionantes_licenca').delete().eq('id', id);
            if (error) throw error;
            return true;
        },

        // Resumo de condicionantes por licença
        async resumoPorLicenca(licencaId) {
            const todas = await this.listarPorLicenca(licencaId);
            const total = todas.length;
            const cumpridas = todas.filter(c => c.status === 'cumprida').length;
            const pendentes = todas.filter(c => c.status === 'pendente').length;
            const atrasadas = todas.filter(c => c.urgencia === 'atrasada').length;
            const criticas = todas.filter(c => c.urgencia === 'critica').length;

            return {
                total,
                cumpridas,
                pendentes,
                atrasadas,
                criticas,
                percentual_cumprido: total > 0 ? Math.round((cumpridas / total) * 100) : 0,
                proxima_vencendo: todas.filter(c => c.status === 'pendente').sort((a, b) => a.dias_restantes - b.dias_restantes)[0] || null,
            };
        }
    }
};
