// =============================================
// licencas.js — Gestão de Licenças com
// Condicionantes embutidas no painel de cada licença
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

    // 1. SESSÃO
    const session = await EcoBackend.checkSession();
    if (!session) { window.location.href = 'index.html'; return; }

    // Sidebar user info
    const nome = session.user?.name || 'Usuário';
    document.getElementById('user-name').textContent = nome;
    document.getElementById('user-email').textContent = session.user?.email || '';

    // 2. CARREGAR DADOS
    let todasLicencas = [];
    let filtroAtual = 'todos';
    let licencaEditandoId = null; // para modo edição
    let condicionantesTemp = []; // condicionantes temporárias no modal de nova licença

    await carregarLicencas();
    await carregarClientesNoSelect();
    await popularCondicionantesPadrao();

    // 3. SETUP EVENTOS
    setupFiltros();
    setupModalNovaLicenca();
    setupMobileSidebar();
    setupLogout();

    // ==========================================
    // CARREGAR LICENÇAS
    // ==========================================
    async function carregarLicencas() {
        const container = document.getElementById('licencas-list');
        container.innerHTML = '<div class="text-center py-12"><span class="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span><p class="text-sm text-slate-500 mt-2">Carregando licenças...</p></div>';

        try {
            todasLicencas = await EcoQueries.licencas.listar();
            atualizarKPIs(todasLicencas);
            renderLicencas(todasLicencas);
        } catch (err) {
            container.innerHTML = '<p class="text-center text-red-400 py-12">Erro ao carregar licenças</p>';
        }
    }

    // ==========================================
    // ATUALIZAR KPIs
    // ==========================================
    function atualizarKPIs(licencas) {
        const contagens = { vigente: 0, vencida: 0, renovando: 0, exigencia: 0 };
        licencas.forEach(l => {
            const s = (l.status || '').toLowerCase();
            if (s === 'vigente' || s === 'ativa') contagens.vigente++;
            else if (s === 'vencida') contagens.vencida++;
            else if (s === 'em renovação' || s === 'renovando') contagens.renovando++;
            else if (s === 'em exigência' || s === 'exigencia') contagens.exigencia++;
            else contagens.vigente++; // fallback
        });

        animateCount('kpi-vigentes', contagens.vigente);
        animateCount('kpi-vencidas', contagens.vencida);
        animateCount('kpi-renovando', contagens.renovando);
        animateCount('kpi-exigencia', contagens.exigencia);
    }

    function animateCount(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 20));
        const interval = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current;
            if (current >= target) clearInterval(interval);
        }, 30);
    }

    // ==========================================
    // RENDER LICENÇAS (com condicionantes embutidas)
    // ==========================================
    function renderLicencas(licencas) {
        const container = document.getElementById('licencas-list');

        if (filtroAtual !== 'todos') {
            licencas = licencas.filter(l => {
                const s = (l.status || '').toLowerCase();
                if (filtroAtual === 'vigente') return s === 'vigente' || s === 'ativa';
                if (filtroAtual === 'vencida') return s === 'vencida';
                if (filtroAtual === 'renovando') return s === 'em renovação' || s === 'renovando';
                if (filtroAtual === 'exigencia') return s === 'em exigência' || s === 'exigencia';
                return true;
            });
        }

        if (licencas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16 glass-panel rounded-2xl">
                    <span class="material-symbols-outlined text-5xl text-slate-600 mb-3">folder_open</span>
                    <p class="text-slate-400 font-semibold">Nenhuma licença encontrada</p>
                    <p class="text-xs text-slate-500 mt-1">Clique em "Nova Licença" para adicionar</p>
                </div>`;
            return;
        }

        container.innerHTML = licencas.map((lic, i) => {
            const statusInfo = getStatusInfo(lic.status);
            const vencimento = lic.vencimento || lic.data_vencimento || '';
            const diasVenc = calcDiasVencimento(vencimento);
            const diasLabel = diasVenc !== null
                ? (diasVenc < 0 ? `<span class="text-red-400 font-bold">${Math.abs(diasVenc)}d atrás</span>` :
                    diasVenc <= 30 ? `<span class="text-yellow-400 font-bold">${diasVenc}d restantes</span>` :
                        `<span class="text-slate-400">${diasVenc}d restantes</span>`)
                : '';

            return `
            <div class="licenca-card glass-panel rounded-2xl overflow-hidden card-glow fade-in" style="animation-delay: ${i * 0.05}s" data-licenca-id="${lic.id}">
                <!-- Header da licença (clicável para expandir) -->
                <div class="lic-header p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" onclick="window.toggleLicencaPanel(${lic.id})">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="size-11 rounded-xl ${statusInfo.bgClass} flex items-center justify-center">
                                <span class="material-symbols-outlined ${statusInfo.textClass}">${statusInfo.icon}</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-100">${lic.tipo || 'Licença'} — <span class="text-primary">${lic.numero || '#' + lic.id}</span></h4>
                                <p class="text-xs text-slate-400 mt-0.5">${lic.cliente || 'Cliente'} · ${lic.orgao || 'Órgão'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-right hidden sm:block">
                                <span class="text-[10px] px-2.5 py-1 rounded-full font-bold ${statusInfo.badgeClass}">${statusInfo.label}</span>
                                <p class="text-[10px] text-slate-500 mt-1">${diasLabel}</p>
                            </div>
                            <div class="flex items-center gap-1">
                                <span class="cond-mini-badge text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary" id="cond-badge-${lic.id}" title="Condicionantes">
                                    <span class="material-symbols-outlined text-[10px]">checklist</span>
                                    <span id="cond-badge-count-${lic.id}">…</span>
                                </span>
                                <span class="material-symbols-outlined text-slate-500 transition-transform duration-300" id="expand-icon-${lic.id}">expand_more</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Painel expandível: Detalhes + Condicionantes -->
                <div class="lic-panel hidden" id="panel-${lic.id}">
                    <div class="border-t border-white/5">

                        <!-- Info resumida -->
                        <div class="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/[0.01]">
                            <div>
                                <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vencimento</p>
                                <p class="text-sm font-semibold text-slate-200 mt-0.5">${EcoBackend.formatDate ? EcoBackend.formatDate(vencimento) : vencimento}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Órgão</p>
                                <p class="text-sm font-semibold text-slate-200 mt-0.5">${lic.orgao || '—'}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Taxa</p>
                                <p class="text-sm font-semibold text-slate-200 mt-0.5">${lic.taxa ? 'R$ ' + Number(lic.taxa).toLocaleString('pt-BR') : '—'}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status</p>
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${statusInfo.badgeClass}">${statusInfo.label}</span>
                            </div>
                        </div>

                        <!-- SEÇÃO CONDICIONANTES (dentro do painel) -->
                        <div class="border-t border-white/5 p-5">
                            <div class="flex items-center justify-between mb-4">
                                <h5 class="text-sm font-bold flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary text-[18px]">checklist</span>
                                    Condicionantes Ambientais
                                </h5>
                                <button class="btn-ghost text-[11px] px-3 py-1.5" onclick="event.stopPropagation(); window.abrirAddCondicionante(${lic.id})">
                                    <span class="material-symbols-outlined text-[14px]">add</span>
                                    Adicionar
                                </button>
                            </div>

                            <!-- Progress bar de compliance -->
                            <div class="flex items-center gap-3 mb-4">
                                <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div class="h-full rounded-full bg-primary transition-all duration-700" id="cond-bar-${lic.id}" style="width: 0%"></div>
                                </div>
                                <span class="text-xs font-bold text-primary" id="cond-pct-${lic.id}">—</span>
                            </div>

                            <!-- Lista de condicionantes -->
                            <div id="cond-list-${lic.id}" class="space-y-2">
                                <p class="text-center text-slate-500 text-xs py-4">Carregando...</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
        }).join('');

        // Carregar badges de condicionantes para todas as licenças
        licencas.forEach(lic => carregarBadgeCondicionante(lic.id));
    }

    // ==========================================
    // TOGGLE DO PAINEL (expandir/colapsar)
    // ==========================================
    window.toggleLicencaPanel = async function (licId) {
        const panel = document.getElementById(`panel-${licId}`);
        const icon = document.getElementById(`expand-icon-${licId}`);
        if (!panel) return;

        const isHidden = panel.classList.contains('hidden');

        // Fechar todos os painéis
        document.querySelectorAll('.lic-panel').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('[id^="expand-icon-"]').forEach(i => i.style.transform = '');

        if (isHidden) {
            panel.classList.remove('hidden');
            panel.style.opacity = '0';
            panel.style.maxHeight = '0';
            icon.style.transform = 'rotate(180deg)';

            requestAnimationFrame(() => {
                panel.style.transition = 'opacity 0.3s ease, max-height 0.5s ease';
                panel.style.opacity = '1';
                panel.style.maxHeight = '2000px';
            });

            // Carregar condicionantes desta licença
            await carregarCondicionantesLicenca(licId);
        }
    };

    // ==========================================
    // CARREGAR CONDICIONANTES DE UMA LICENÇA
    // ==========================================
    async function carregarCondicionantesLicenca(licId) {
        const container = document.getElementById(`cond-list-${licId}`);
        const barEl = document.getElementById(`cond-bar-${licId}`);
        const pctEl = document.getElementById(`cond-pct-${licId}`);
        if (!container) return;

        try {
            const condicionantes = await EcoQueries.condicionantes.listarPorLicenca(licId);
            const resumo = await EcoQueries.condicionantes.resumoPorLicenca(licId);

            // Atualizar progress
            if (barEl) barEl.style.width = resumo.percentual_cumprido + '%';
            if (pctEl) pctEl.textContent = resumo.percentual_cumprido + '% cumprido';

            if (condicionantes.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-6 border border-dashed border-white/10 rounded-xl">
                        <span class="material-symbols-outlined text-2xl text-slate-600 mb-1">checklist</span>
                        <p class="text-xs text-slate-400">Nenhuma condicionante vinculada</p>
                        <button class="text-xs text-primary font-bold mt-2 hover:underline" onclick="event.stopPropagation(); window.abrirAddCondicionante(${licId})">
                            + Adicionar condicionante
                        </button>
                    </div>`;
                return;
            }

            container.innerHTML = condicionantes.map(c => renderCondicionanteCard(c, licId)).join('');

        } catch (err) {
            container.innerHTML = '<p class="text-center text-red-400 text-xs py-4">Erro ao carregar condicionantes</p>';
        }
    }

    // ==========================================
    // RENDER CARD DE CONDICIONANTE (dentro do painel)
    // ==========================================
    function renderCondicionanteCard(c, licId) {
        const diasLabel = c.status === 'cumprida'
            ? '<span class="text-emerald-400 font-bold">✓ Cumprida</span>'
            : c.dias_restantes < 0
                ? `<span class="text-red-400 font-bold">${Math.abs(c.dias_restantes)} dias atrasado</span>`
                : c.dias_restantes <= 15
                    ? `<span class="text-red-400 font-bold">${c.dias_restantes} dias restantes</span>`
                    : c.dias_restantes <= 30
                        ? `<span class="text-yellow-400 font-bold">${c.dias_restantes} dias restantes</span>`
                        : `<span class="text-slate-400">${c.dias_restantes} dias restantes</span>`;

        const urgenciaIcon =
            c.urgencia === 'cumprida' ? 'check_circle' :
                c.urgencia === 'atrasada' ? 'error' :
                    c.urgencia === 'critica' ? 'warning' :
                        c.urgencia === 'alerta' ? 'schedule' : 'radio_button_unchecked';

        const statusChecked = c.status === 'cumprida' ? 'checked' : '';
        const opacityClass = c.status === 'cumprida' ? 'opacity-60' : '';

        return `
        <div class="cond-card glass-panel rounded-xl p-4 relative overflow-hidden ${opacityClass}" data-cond-id="${c.id}">
            <div class="cond-urgencia-bar" style="background: ${c.urgencia_cor}"></div>
            <div class="flex items-start gap-3">
                <!-- Checkbox de cumprimento -->
                <label class="mt-0.5 cursor-pointer">
                    <input type="checkbox" ${statusChecked} class="sr-only peer" onchange="window.toggleCondicionante(${c.id}, ${licId}, this.checked)">
                    <span class="material-symbols-outlined text-[20px] peer-checked:text-emerald-400 text-slate-500 transition-colors"
                        >${c.status === 'cumprida' ? 'check_circle' : 'radio_button_unchecked'}</span>
                </label>

                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-200 ${c.status === 'cumprida' ? 'line-through text-slate-500' : ''}">${c.descricao}</p>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                        <span class="text-[10px] text-slate-500 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[12px]">calendar_month</span>
                            ${c.vencimento_formatado || c.prazo_vencimento}
                        </span>
                        <span class="text-[10px]">${diasLabel}</span>
                        ${c.observacao ? `<span class="text-[10px] text-slate-500 italic truncate max-w-[200px]">${c.observacao}</span>` : ''}
                    </div>
                    ${c.arquivo_url ? `
                        <span class="inline-flex items-center gap-1 text-[10px] text-blue-400 mt-1.5 hover:underline cursor-pointer">
                            <span class="material-symbols-outlined text-[12px]">attach_file</span>
                            ${c.arquivo_url}
                        </span>
                    ` : ''}
                </div>

                <!-- Ações -->
                <div class="flex items-center gap-1.5 shrink-0">
                    ${c.status !== 'cumprida' ? `
                        <button class="size-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-emerald-500/20 transition-colors" title="Anexar comprovante" onclick="event.stopPropagation(); window.uploadComprovante(${c.id}, ${licId})">
                            <span class="material-symbols-outlined text-[14px] text-slate-400 hover:text-emerald-400">upload_file</span>
                        </button>
                    ` : ''}
                    <button class="size-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-colors" title="Remover" onclick="event.stopPropagation(); window.excluirCondicionante(${c.id}, ${licId})">
                        <span class="material-symbols-outlined text-[14px] text-slate-400 hover:text-red-400">delete</span>
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ==========================================
    // BADGE DE CONDICIONANTES (mini icon no header)
    // ==========================================
    async function carregarBadgeCondicionante(licId) {
        try {
            const resumo = await EcoQueries.condicionantes.resumoPorLicenca(licId);
            const badge = document.getElementById(`cond-badge-count-${licId}`);
            if (badge) {
                badge.textContent = `${resumo.cumpridas}/${resumo.total}`;
            }
            const badgeEl = document.getElementById(`cond-badge-${licId}`);
            if (badgeEl) {
                if (resumo.atrasadas > 0) {
                    badgeEl.className = badgeEl.className.replace('bg-primary/10 text-primary', 'bg-red-500/15 text-red-400');
                } else if (resumo.criticas > 0) {
                    badgeEl.className = badgeEl.className.replace('bg-primary/10 text-primary', 'bg-yellow-500/15 text-yellow-400');
                }
            }
        } catch (err) { /* silently fail */ }
    }

    // ==========================================
    // TOGGLE CONDICIONANTE (cumprir / descumprir)
    // ==========================================
    window.toggleCondicionante = async function (condId, licId, checked) {
        try {
            if (checked) {
                await EcoQueries.condicionantes.marcarCumprida(condId);
                showToast('Condicionante marcada como cumprida!', 'success');
            } else {
                await EcoQueries.condicionantes.atualizar(condId, { status: 'pendente' });
                showToast('Status revertido para pendente', 'info');
            }
            await carregarCondicionantesLicenca(licId);
            await carregarBadgeCondicionante(licId);
        } catch (err) {
            showToast('Erro ao atualizar condicionante', 'error');
        }
    };

    // ==========================================
    // EXCLUIR CONDICIONANTE
    // ==========================================
    window.excluirCondicionante = async function (condId, licId) {
        const result = await Swal.fire({
            title: 'Remover condicionante?',
            text: 'A condicionante será desvinculada da licença.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f87171',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Remover',
            cancelButtonText: 'Cancelar',
            background: '#0f1712',
            color: '#e2e8f0',
        });

        if (result.isConfirmed) {
            await EcoQueries.condicionantes.excluir(condId);
            showToast('Condicionante removida', 'success');
            await carregarCondicionantesLicenca(licId);
            await carregarBadgeCondicionante(licId);
        }
    };

    // ==========================================
    // UPLOAD COMPROVANTE
    // ==========================================
    window.uploadComprovante = async function (condId, licId) {
        const { value: file } = await Swal.fire({
            title: 'Anexar comprovante',
            html: '<p class="text-sm text-slate-400 mb-3">Selecione o arquivo comprobatório para marcar como cumprida.</p>',
            input: 'file',
            inputAttributes: { accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' },
            showCancelButton: true,
            confirmButtonText: 'Enviar e marcar cumprida',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4ade80',
            background: '#0f1712',
            color: '#e2e8f0',
        });

        if (file) {
            try {
                const nomeArquivo = file.name;
                await EcoQueries.condicionantes.marcarCumprida(condId, nomeArquivo);
                showToast(`Comprovante "${nomeArquivo}" anexado e condicionante cumprida!`, 'success');
                await carregarCondicionantesLicenca(licId);
                await carregarBadgeCondicionante(licId);
            } catch (err) {
                showToast('Erro ao enviar comprovante', 'error');
            }
        }
    };

    // ==========================================
    // ABRIR MODAL DE ADICIONAR CONDICIONANTE
    // ==========================================
    window.abrirAddCondicionante = async function (licId) {
        const padrao = await EcoQueries.condicionantes.listarPadrao();
        const existentes = await EcoQueries.condicionantes.listarPorLicenca(licId);
        const existentesIds = existentes.map(e => e.condicionante_padrao_id);

        // Filtrar: não mostrar condicionantes que já existem na licença
        const disponiveis = padrao.filter(p => !existentesIds.includes(p.id));

        const optionsHTML = disponiveis.map(p =>
            `<option value="${p.id}" data-desc="${p.descricao}">${p.descricao} ${p.obrigatoria ? '⚠️' : ''}</option>`
        ).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Adicionar Condicionante',
            html: `
                <div style="text-align:left; font-size:13px; color:#94a3b8;">
                    <label style="display:block;margin-bottom:4px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Selecione da lista padrão</label>
                    <select id="swal-cond-padrao" class="swal2-select" style="width:100%;background:#1a2520;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;font-size:13px;margin-bottom:16px;">
                        <option value="">— Escolha uma condicionante —</option>
                        ${optionsHTML}
                    </select>

                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                        <div style="flex:1;height:1px;background:rgba(255,255,255,0.05);"></div>
                        <span style="font-size:10px;color:#64748b;font-weight:700;">OU CRIE UMA NOVA</span>
                        <div style="flex:1;height:1px;background:rgba(255,255,255,0.05);"></div>
                    </div>

                    <label style="display:block;margin-bottom:4px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Descrição personalizada</label>
                    <input id="swal-cond-custom" class="swal2-input" placeholder="Descreva a condicionante..." style="background:#1a2520;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;font-size:13px;width:100%;box-sizing:border-box;margin-bottom:12px;">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div>
                            <label style="display:block;margin-bottom:4px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Prazo de Vencimento *</label>
                            <input type="date" id="swal-cond-prazo" class="swal2-input" style="background:#1a2520;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;font-size:13px;width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;margin-bottom:4px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Observação</label>
                            <input id="swal-cond-obs" class="swal2-input" placeholder="Detalhes..." style="background:#1a2520;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;font-size:13px;width:100%;box-sizing:border-box;">
                        </div>
                    </div>

                    <label style="display:flex;align-items:center;gap:8px;margin-top:16px;cursor:pointer;">
                        <input type="checkbox" id="swal-cond-salvar-padrao" style="accent-color:#4ade80;">
                        <span style="font-size:11px;color:#cbd5e1;">Salvar como condicionante padrão para futuras licenças</span>
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Adicionar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4ade80',
            background: '#0f1712',
            color: '#e2e8f0',
            width: 560,
            preConfirm: () => {
                const padrao = document.getElementById('swal-cond-padrao').value;
                const custom = document.getElementById('swal-cond-custom').value.trim();
                const prazo = document.getElementById('swal-cond-prazo').value;
                const obs = document.getElementById('swal-cond-obs').value.trim();
                const salvarPadrao = document.getElementById('swal-cond-salvar-padrao').checked;

                if (!padrao && !custom) {
                    Swal.showValidationMessage('Selecione uma condicionante padrão ou crie uma nova');
                    return false;
                }
                if (!prazo) {
                    Swal.showValidationMessage('O prazo de vencimento é obrigatório');
                    return false;
                }

                let descricao;
                let condPadraoId = null;
                if (padrao) {
                    const sel = document.getElementById('swal-cond-padrao');
                    descricao = sel.options[sel.selectedIndex].dataset.desc;
                    condPadraoId = parseInt(padrao);
                } else {
                    descricao = custom;
                }

                return { descricao, condPadraoId, prazo, obs, salvarPadrao };
            }
        });

        if (formValues) {
            try {
                // Se marcou para salvar como padrão
                if (formValues.salvarPadrao && !formValues.condPadraoId) {
                    const novaP = await EcoQueries.condicionantes.criarCustomizada(formValues.descricao);
                    formValues.condPadraoId = novaP.id;
                    showToast(`"${formValues.descricao}" salva como condicionante padrão!`, 'info');
                }

                // Criar condicionante vinculada à licença
                await EcoQueries.condicionantes.criar(licId, {
                    condicionante_padrao_id: formValues.condPadraoId,
                    descricao: formValues.descricao,
                    prazo_vencimento: formValues.prazo,
                    observacao: formValues.obs,
                });

                showToast('Condicionante adicionada com sucesso!', 'success');
                await carregarCondicionantesLicenca(licId);
                await carregarBadgeCondicionante(licId);

            } catch (err) {
                showToast('Erro ao adicionar condicionante: ' + err.message, 'error');
            }
        }
    };

    // ==========================================
    // FILTROS
    // ==========================================
    function setupFiltros() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filtroAtual = btn.dataset.filter;
                renderLicencas(todasLicencas);
            });
        });
    }

    // ==========================================
    // MODAL: Nova Licença
    // ==========================================
    function setupModalNovaLicenca() {
        const modal = document.getElementById('modal-licenca');
        const btnNova = document.getElementById('btn-nova-licenca');
        const btnNovaMobile = document.getElementById('btn-nova-licenca-mobile');
        const btnClose = document.getElementById('modal-close');
        const btnCancel = document.getElementById('btn-cancel-modal');
        const overlay = document.getElementById('modal-overlay');
        const btnSave = document.getElementById('btn-save-licenca');

        function openModal() {
            modal.classList.remove('hidden');
            licencaEditandoId = null;
            condicionantesTemp = [];
            document.getElementById('modal-titulo').querySelector('span:last-child')?.remove();
            resetFormLicenca();
            atualizarCondicionantesModal();
        }

        function closeModal() {
            modal.classList.add('hidden');
        }

        if (btnNova) btnNova.addEventListener('click', openModal);
        if (btnNovaMobile) btnNovaMobile.addEventListener('click', openModal);
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        // Tabs do modal
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById('mtab-' + tab.dataset.mtab).classList.remove('hidden');
            });
        });

        // Adicionar condicionante no modal de criação
        document.getElementById('btn-add-cond')?.addEventListener('click', async () => {
            const selPadrao = document.getElementById('cond-padrao-select');
            const customDesc = document.getElementById('cond-custom-desc').value.trim();
            const prazo = document.getElementById('cond-prazo').value;
            const obs = document.getElementById('cond-obs').value.trim();

            const padrao = selPadrao.value;
            if (!padrao && !customDesc) {
                showToast('Selecione ou crie uma condicionante', 'warning');
                return;
            }
            if (!prazo) {
                showToast('Informe o prazo de vencimento', 'warning');
                return;
            }

            let descricao;
            let condPadraoId = null;
            if (padrao) {
                descricao = selPadrao.options[selPadrao.selectedIndex].dataset.desc;
                condPadraoId = parseInt(padrao);
            } else {
                descricao = customDesc;
            }

            condicionantesTemp.push({
                condicionante_padrao_id: condPadraoId,
                descricao,
                prazo_vencimento: prazo,
                observacao: obs,
                status: 'pendente'
            });

            // Reset campos
            selPadrao.value = '';
            document.getElementById('cond-custom-desc').value = '';
            document.getElementById('cond-prazo').value = '';
            document.getElementById('cond-obs').value = '';

            atualizarCondicionantesModal();
            showToast('Condicionante adicionada à lista', 'success');
        });

        // Salvar como padrão
        document.getElementById('btn-add-custom-cond')?.addEventListener('click', async () => {
            const desc = document.getElementById('cond-custom-desc').value.trim();
            if (!desc) {
                showToast('Descreva a condicionante para salvar como padrão', 'warning');
                return;
            }
            await EcoQueries.condicionantes.criarCustomizada(desc);
            await popularCondicionantesPadrao();
            showToast(`"${desc}" salva como condicionante padrão!`, 'success');
            document.getElementById('cond-custom-desc').value = '';
        });

        // Salvar licença
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const titulo = document.getElementById('lic-titulo').value.trim();
                const processo = document.getElementById('lic-processo').value.trim();
                const tipo = document.getElementById('lic-tipo').value;
                const clienteId = document.getElementById('lic-cliente').value;
                const orgao = document.getElementById('lic-orgao').value;
                const vencimento = document.getElementById('lic-vencimento').value;
                const taxa = document.getElementById('lic-taxa').value;
                const obs = document.getElementById('lic-observacao').value.trim();

                if (!titulo || !processo || !clienteId || !vencimento) {
                    showToast('Preencha os campos obrigatórios', 'warning');
                    return;
                }

                try {
                    btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Salvando...';
                    btnSave.disabled = true;

                    const novaLicenca = await EcoQueries.licencas.criar({
                        tipo, numero: processo, titulo,
                        cliente_id: parseInt(clienteId),
                        orgao, vencimento, taxa: parseFloat(taxa) || 0,
                        observacao: obs, status: 'vigente'
                    });

                    // Criar todas as condicionantes temporárias
                    for (const cond of condicionantesTemp) {
                        await EcoQueries.condicionantes.criar(novaLicenca.id, cond);
                    }

                    showToast(`Licença "${titulo}" criada com ${condicionantesTemp.length} condicionante(s)!`, 'success');
                    closeModal();
                    await carregarLicencas();

                } catch (err) {
                    showToast('Erro ao salvar: ' + err.message, 'error');
                } finally {
                    btnSave.innerHTML = '<span class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">save</span> Salvar Licença</span>';
                    btnSave.disabled = false;
                }
            });
        }
    }

    function atualizarCondicionantesModal() {
        const container = document.getElementById('condicionantes-lista');
        const countEl = document.getElementById('condicionantes-count');
        const progressBar = document.getElementById('cond-progress-bar');
        const progressPct = document.getElementById('cond-progress-pct');
        const totalEl = document.getElementById('cond-total');
        const emptyEl = document.getElementById('cond-empty');

        if (countEl) countEl.textContent = condicionantesTemp.length;
        if (totalEl) totalEl.textContent = condicionantesTemp.length;
        if (progressBar) progressBar.style.width = '0%';
        if (progressPct) progressPct.textContent = '0%';

        if (condicionantesTemp.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            container.querySelectorAll('.cond-card').forEach(c => c.remove());
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');

        // Limpar itens antigos e renderizar novos
        container.querySelectorAll('.cond-card').forEach(c => c.remove());
        condicionantesTemp.forEach((c, i) => {
            const dias = calcDiasVencimento(c.prazo_vencimento);
            const div = document.createElement('div');
            div.className = 'cond-card glass-panel rounded-xl p-4 relative overflow-hidden animate-[slideUp_0.2s_ease]';
            div.innerHTML = `
                <div class="cond-urgencia-bar" style="background: ${dias < 0 ? '#f87171' : dias <= 30 ? '#fbbf24' : '#60a5fa'}"></div>
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-primary text-[18px]">check_box_outline_blank</span>
                        <div>
                            <p class="text-sm font-semibold text-slate-200">${c.descricao}</p>
                            <p class="text-[10px] text-slate-500">Vence: ${c.prazo_vencimento} ${c.observacao ? ' · ' + c.observacao : ''}</p>
                        </div>
                    </div>
                    <button class="size-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-colors" onclick="window.removerCondTemp(${i})">
                        <span class="material-symbols-outlined text-[14px] text-slate-400">delete</span>
                    </button>
                </div>`;
            container.appendChild(div);
        });
    }

    window.removerCondTemp = function (index) {
        condicionantesTemp.splice(index, 1);
        atualizarCondicionantesModal();
    };

    function resetFormLicenca() {
        ['lic-titulo', 'lic-processo', 'lic-taxa', 'lic-observacao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const venc = document.getElementById('lic-vencimento');
        if (venc) venc.value = '';
    }

    // ==========================================
    // POPULAR SELECT DE CLIENTES
    // ==========================================
    async function carregarClientesNoSelect() {
        const select = document.getElementById('lic-cliente');
        if (!select) return;

        try {
            const clientes = await EcoQueries.clientes.listar();
            clientes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nome || c.razao_social || `Cliente #${c.id}`;
                select.appendChild(opt);
            });
        } catch (err) { /* silent */ }
    }

    // ==========================================
    // POPULAR SELECT DE CONDICIONANTES PADRÃO
    // ==========================================
    async function popularCondicionantesPadrao() {
        const select = document.getElementById('cond-padrao-select');
        if (!select) return;

        try {
            const padrao = await EcoQueries.condicionantes.listarPadrao();
            // Reset
            select.innerHTML = '<option value="">— Escolha uma condicionante —</option>';
            padrao.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.descricao} ${p.obrigatoria ? '⚠️' : ''}`;
                opt.dataset.desc = p.descricao;
                select.appendChild(opt);
            });
        } catch (err) { /* silent */ }
    }

    // ==========================================
    // HELPERS
    // ==========================================
    function getStatusInfo(status) {
        const s = (status || '').toLowerCase();
        const map = {
            'vigente': { icon: 'verified', label: 'Vigente', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', badgeClass: 'bg-emerald-500/15 text-emerald-400' },
            'ativa': { icon: 'verified', label: 'Vigente', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', badgeClass: 'bg-emerald-500/15 text-emerald-400' },
            'vencida': { icon: 'event_busy', label: 'Vencida', bgClass: 'bg-red-500/15', textClass: 'text-red-400', badgeClass: 'bg-red-500/15 text-red-400' },
            'em renovação': { icon: 'autorenew', label: 'Renovando', bgClass: 'bg-yellow-500/15', textClass: 'text-yellow-400', badgeClass: 'bg-yellow-500/15 text-yellow-400' },
            'renovando': { icon: 'autorenew', label: 'Renovando', bgClass: 'bg-yellow-500/15', textClass: 'text-yellow-400', badgeClass: 'bg-yellow-500/15 text-yellow-400' },
            'em exigência': { icon: 'pending', label: 'Em Exigência', bgClass: 'bg-blue-500/15', textClass: 'text-blue-400', badgeClass: 'bg-blue-500/15 text-blue-400' },
            'exigencia': { icon: 'pending', label: 'Em Exigência', bgClass: 'bg-blue-500/15', textClass: 'text-blue-400', badgeClass: 'bg-blue-500/15 text-blue-400' },
        };
        return map[s] || map['vigente'];
    }

    function calcDiasVencimento(data) {
        if (!data) return null;
        const hoje = new Date();
        const venc = new Date(data + 'T00:00:00');
        return Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
    }

    function setupMobileSidebar() {
        const hamburger = document.getElementById('hamburger-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!hamburger) return;
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
        overlay?.addEventListener('click', () => {
            hamburger.classList.remove('active');
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    function setupLogout() {
        document.getElementById('btn-logout')?.addEventListener('click', () => EcoBackend.logout());
    }

    function showToast(msg, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true, position: 'top-end', icon: type, title: msg,
                showConfirmButton: false, timer: 3000, timerProgressBar: true,
                background: '#0f1712', color: '#e2e8f0',
            });
        }
    }
});
