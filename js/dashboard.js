// =============================================
// dashboard.js — Lógica completa do Dashboard
// Com dados reais do EcoBackend + Animações
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

    // 1. CHECAGEM DE SESSÃO
    const session = await window.EcoBackend.checkSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }

    // 2. RENDER USER DATA
    renderUserInfo(session);

    // 3. SETUP GREETING DINÂMICO
    setupGreeting(session);

    // 4. SETUP SIDEBAR MOBILE
    setupMobileSidebar();

    // 5. CARREGAR DADOS DO DASHBOARD
    await loadDashboardData();

    // 6. SETUP BUSCA RELACIONAL
    setupRelationalSearch();

    // 7. SETUP NOTIFICAÇÕES
    await setupNotifications();

    // 8. SETUP LOGOUT
    document.getElementById('btn-logout').addEventListener('click', () => {
        window.EcoBackend.logout();
    });

    // ==========================================
    // RENDER USER INFO
    // ==========================================
    function renderUserInfo(session) {
        const emailEl = document.getElementById('user-email');
        const nameEl = document.getElementById('user-name');
        const avatarImg = document.getElementById('user-avatar');
        const avatarIcon = document.getElementById('user-avatar-icon');

        if (session.mock) {
            emailEl.textContent = session.user.email;
            nameEl.textContent = session.user.name;
        } else if (session.user) {
            emailEl.textContent = session.user.email;
            nameEl.textContent = session.user.user_metadata?.full_name || "Usuário";

            if (session.user.user_metadata?.avatar_url) {
                avatarImg.src = session.user.user_metadata.avatar_url;
                avatarImg.classList.remove('hidden');
                avatarIcon.classList.add('hidden');
            }
        }
    }

    // ==========================================
    // GREETING DINÂMICO (Bom dia / Boa tarde / Boa noite)
    // ==========================================
    function setupGreeting(session) {
        const greetingEl = document.getElementById('greeting-time');
        const subtitleEl = document.getElementById('greeting-subtitle');
        const hour = new Date().getHours();
        let greeting, emoji;

        if (hour >= 5 && hour < 12) {
            greeting = '☀️ Bom dia';
            emoji = 'wb_sunny';
        } else if (hour >= 12 && hour < 18) {
            greeting = '🌤️ Boa tarde';
            emoji = 'wb_twilight';
        } else {
            greeting = '🌙 Boa noite';
            emoji = 'nights_stay';
        }

        const userName = session.mock ? session.user.name : (session.user?.user_metadata?.full_name || 'Administrador');
        greetingEl.textContent = `${greeting}, ${userName.split(' ')[0]}`;
        subtitleEl.textContent = `Monitoramento de operações e licenças ambientais • ${formatDateFull(new Date())}`;
    }

    // ==========================================
    // MOBILE SIDEBAR
    // ==========================================
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

        overlay.addEventListener('click', () => {
            hamburger.classList.remove('active');
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // ==========================================
    // CARREGAR TODOS OS DADOS
    // ==========================================
    async function loadDashboardData() {
        try {
            // Buscar dados integrados
            const stats = await EcoBackend.getDashboardStats();

            // Renderizar KPIs com animação de contagem
            animateCounter('kpi-processos', stats.totalLicencas, 0, '');
            animateCounter('kpi-vencendo', stats.vencendo30d, 0, '');
            animateCounter('kpi-receita', stats.totalReceita, 0, 'currency');
            animateCounter('kpi-saldo', stats.saldo, 0, 'currency');

            // Tendências
            updateTrend('kpi-trend-processos', `+${stats.vigentes}`, true);
            updateTrend('kpi-trend-vencendo', stats.vencendo30d > 5 ? 'Crítico' : `${stats.vencendo30d}`, stats.vencendo30d <= 5);
            updateTrend('kpi-trend-receita', `+${Math.round((stats.totalReceita / (stats.totalReceita + stats.totalDespesa)) * 100)}%`, true);
            updateTrend('kpi-trend-saldo', stats.saldo > 0 ? 'Positivo' : 'Negativo', stats.saldo > 0);

            // Atualizar contadores na sidebar
            const navClients = document.getElementById('nav-clients-count');
            const navLicenses = document.getElementById('nav-licenses-count');
            if (navClients) navClients.textContent = stats.totalClientes;
            if (navLicenses) navLicenses.textContent = stats.totalLicencas;

            // Renderizar gráficos
            renderComplianceChart(stats.licencas);
            renderLicenseDonutChart(stats.licencas);

            // Renderizar tabela financeira
            renderFinancialTable(stats.financeiro);

            // Renderizar timeline de atividades
            await renderActivityTimeline();

            // Atualizar AI Insight
            updateAIInsight(stats);

        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            showToast('Erro ao carregar dados do dashboard', 'error');
        }
    }

    // ==========================================
    // ANIMAÇÃO DE CONTAGEM (Count-Up)
    // ==========================================
    function animateCounter(elementId, targetValue, startValue = 0, format = '') {
        const el = document.getElementById(elementId);
        if (!el) return;

        const duration = 1500;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing: easeOutExpo
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const currentValue = Math.round(startValue + (targetValue - startValue) * eased);

            if (format === 'currency') {
                el.textContent = EcoBackend.formatCurrency(currentValue);
            } else {
                el.textContent = currentValue.toLocaleString('pt-BR');
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ==========================================
    // ATUALIZAR TENDÊNCIA
    // ==========================================
    function updateTrend(elementId, text, isPositive) {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.classList.remove('up', 'down', 'critical');

        if (text === 'Crítico') {
            el.classList.add('critical');
            el.innerHTML = text;
        } else if (isPositive) {
            el.classList.add('up');
            el.innerHTML = `<span class="material-symbols-outlined text-[12px]">trending_up</span> ${text}`;
        } else {
            el.classList.add('down');
            el.innerHTML = `<span class="material-symbols-outlined text-[12px]">trending_down</span> ${text}`;
        }
    }

    // ==========================================
    // GRÁFICO: COMPLIANCE ANUAL (Line Chart)
    // ==========================================
    function renderComplianceChart(licencas) {
        const ctx = document.getElementById('complianceChart');
        if (!ctx) return;
        const context = ctx.getContext('2d');

        // Gradiente para área
        const gradientRenovadas = context.createLinearGradient(0, 0, 0, 400);
        gradientRenovadas.addColorStop(0, 'rgba(74, 222, 128, 0.6)');
        gradientRenovadas.addColorStop(1, 'rgba(74, 222, 128, 0.0)');

        const gradientVencendo = context.createLinearGradient(0, 0, 0, 400);
        gradientVencendo.addColorStop(0, 'rgba(248, 113, 113, 0.3)');
        gradientVencendo.addColorStop(1, 'rgba(248, 113, 113, 0.0)');

        // Cálculos baseados nos dados reais de licenças
        const vigentes = licencas.filter(l => l.status === 'vigente').length;
        const renovando = licencas.filter(l => l.status === 'renovando').length;
        const vencidas = licencas.filter(l => l.status === 'vencida').length;

        // Simular dados mensais baseados nos dados reais
        const baseLine = vigentes;
        const monthlyRenovadas = [
            Math.round(baseLine * 0.4), Math.round(baseLine * 0.6),
            Math.round(baseLine * 0.5), Math.round(baseLine * 0.8),
            Math.round(baseLine * 0.7), Math.round(baseLine * 1.0),
            Math.round(baseLine * 0.9), Math.round(baseLine * 1.1),
            Math.round(baseLine * 1.0), Math.round(baseLine * 1.4),
            Math.round(baseLine * 1.2), Math.round(baseLine * 1.5)
        ];

        const monthlyVencendo = [
            vencidas + 2, vencidas + 1, vencidas, vencidas + 3,
            vencidas + 4, vencidas - 1, vencidas + 1, vencidas,
            vencidas + 3, vencidas - 1, vencidas, vencidas + 1
        ].map(v => Math.max(0, v));

        const chart = new Chart(context, {
            type: 'line',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                datasets: [
                    {
                        label: 'Licenças Renovadas',
                        data: monthlyRenovadas,
                        borderColor: '#4ade80',
                        backgroundColor: gradientRenovadas,
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#0f1712',
                        pointBorderColor: '#4ade80',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#4ade80',
                    },
                    {
                        label: 'Processos Vencendo',
                        data: monthlyVencendo,
                        borderColor: '#f87171',
                        backgroundColor: gradientVencendo,
                        borderWidth: 2,
                        borderDash: [6, 4],
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#0f1712',
                        pointBorderColor: '#f87171',
                        pointBorderWidth: 2,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#94a3b8',
                            font: { family: "'Outfit', sans-serif", size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 18, 0.95)',
                        titleFont: { family: "'Outfit', sans-serif", size: 14, weight: '700' },
                        bodyFont: { family: "'Outfit', sans-serif", size: 13 },
                        padding: 14,
                        borderColor: 'rgba(74, 222, 128, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 12,
                        displayColors: true,
                        usePointStyle: true,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: "'Outfit', sans-serif", size: 11 },
                            padding: 8,
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: "'Outfit', sans-serif", size: 11 },
                            padding: 8,
                        },
                        border: { display: false }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart',
                }
            }
        });

        // Period toggle buttons
        document.querySelectorAll('.chart-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chart-period-btn').forEach(b => {
                    b.classList.remove('active', 'bg-primary/15', 'text-primary', 'border-primary/20');
                    b.classList.add('glass-input', 'text-slate-400');
                });
                btn.classList.add('active', 'bg-primary/15', 'text-primary', 'border-primary/20');
                btn.classList.remove('glass-input', 'text-slate-400');

                // Animate data change
                const multiplier = btn.dataset.period === '2023' ? 0.7 : 1;
                chart.data.datasets[0].data = monthlyRenovadas.map(v => Math.round(v * multiplier));
                chart.data.datasets[1].data = monthlyVencendo.map(v => Math.round(v * (2 - multiplier)));
                chart.update('active');
            });
        });
    }

    // ==========================================
    // GRÁFICO: DONUT LICENÇAS POR STATUS
    // ==========================================
    function renderLicenseDonutChart(licencas) {
        const ctx = document.getElementById('licenseDonutChart');
        if (!ctx) return;

        const statusMap = {
            vigente: { label: 'Vigentes', color: '#4ade80', icon: 'check_circle' },
            vencida: { label: 'Vencidas', color: '#f87171', icon: 'cancel' },
            renovando: { label: 'Renovando', color: '#fbbf24', icon: 'autorenew' },
            exigencia: { label: 'Em Exigência', color: '#60a5fa', icon: 'pending' },
        };

        // Contar por status
        const counts = {};
        licencas.forEach(l => {
            const s = l.status || 'outro';
            counts[s] = (counts[s] || 0) + 1;
        });

        const labels = [];
        const data = [];
        const colors = [];
        const statusKeys = [];

        Object.entries(counts).forEach(([status, count]) => {
            const info = statusMap[status] || { label: status, color: '#64748b', icon: 'help' };
            labels.push(info.label);
            data.push(count);
            colors.push(info.color);
            statusKeys.push(status);
        });

        const total = data.reduce((a, b) => a + b, 0);
        document.getElementById('donut-total').textContent = total;

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8,
                    spacing: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 18, 0.95)',
                        titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '700' },
                        bodyFont: { family: "'Outfit', sans-serif", size: 12 },
                        padding: 12,
                        borderColor: 'rgba(74, 222, 128, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 10,
                        callbacks: {
                            label: function (context) {
                                const pct = Math.round((context.parsed / total) * 100);
                                return ` ${context.label}: ${context.parsed} (${pct}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });

        // Build custom legend
        const legendContainer = document.getElementById('donut-legend');
        if (legendContainer) {
            legendContainer.innerHTML = labels.map((label, i) => {
                const pct = Math.round((data[i] / total) * 100);
                return `
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-2">
                            <span class="size-2.5 rounded-full shrink-0" style="background: ${colors[i]};"></span>
                            <span class="text-slate-300 font-medium">${label}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-white">${data[i]}</span>
                            <span class="text-slate-500 text-xs">(${pct}%)</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // ==========================================
    // TABELA FINANCEIRA
    // ==========================================
    function renderFinancialTable(financeiro) {
        const tbody = document.getElementById('financial-tbody');
        if (!tbody) return;

        if (financeiro.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-500 py-8">Nenhuma transação encontrada</td></tr>`;
            return;
        }

        tbody.innerHTML = financeiro.map((f, index) => {
            const isReceita = f.tipo === 'receita';
            const statusBadge = getStatusBadge(f.status);
            const valorClass = isReceita ? 'text-emerald-400' : 'text-red-400';
            const valorPrefix = isReceita ? '+' : '-';

            return `
                <tr class="fade-in" style="animation-delay: ${index * 0.05}s;">
                    <td>
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[14px] text-slate-500">calendar_today</span>
                            <span class="text-slate-300">${EcoBackend.formatDate(f.data)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="flex items-center gap-2.5">
                            <span class="p-1.5 rounded-lg ${isReceita ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}">
                                <span class="material-symbols-outlined text-[16px]">${isReceita ? 'arrow_downward' : 'arrow_upward'}</span>
                            </span>
                            <div>
                                <p class="font-semibold text-slate-200 text-sm">${f.cliente}</p>
                                <p class="text-[11px] text-slate-500">${isReceita ? 'Receita' : 'Despesa'}</p>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="text-xs font-medium text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">${f.categoria}</span>
                    </td>
                    <td>
                        <span class="font-bold ${valorClass}">${valorPrefix} ${EcoBackend.formatCurrency(f.valor)}</span>
                    </td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    function getStatusBadge(status) {
        const map = {
            'pago': '<span class="badge badge-success">Pago</span>',
            'pendente': '<span class="badge badge-warning">Pendente</span>',
            'atrasado': '<span class="badge badge-danger">Atrasado</span>',
        };
        return map[status] || `<span class="badge badge-info">${status}</span>`;
    }

    // ==========================================
    // TIMELINE DE ATIVIDADES
    // ==========================================
    async function renderActivityTimeline() {
        const container = document.getElementById('activity-timeline');
        if (!container) return;

        try {
            const atividades = await EcoQueries.atividades.listar(6);

            if (atividades.length === 0) {
                container.innerHTML = '<p class="text-center text-slate-500 text-sm py-4">Nenhuma atividade registrada.</p>';
                return;
            }

            container.innerHTML = atividades.map((a, index) => {
                const timeAgo = getTimeAgo(new Date(a.criado_em));
                const typeClass = getActivityTypeClass(a.tipo);
                const icon = getActivityIcon(a.tipo);

                return `
                    <div class="timeline-item ${typeClass} fade-in" style="animation-delay: ${index * 0.1}s;">
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <p class="text-sm font-medium text-slate-200 leading-snug">${a.descricao}</p>
                                <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[12px]">schedule</span>
                                    ${timeAgo}
                                </p>
                            </div>
                            <span class="material-symbols-outlined text-[16px] text-slate-600 shrink-0 mt-0.5">${icon}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = '<p class="text-center text-sm text-slate-500 py-4">Erro ao carregar atividades</p>';
        }
    }

    function getActivityTypeClass(tipo) {
        const map = { 'login': '', 'criacao': 'info', 'edicao': 'warning', 'exclusao': 'danger', 'upload': 'info' };
        return map[tipo] || '';
    }

    function getActivityIcon(tipo) {
        const map = {
            'login': 'login',
            'criacao': 'add_circle',
            'edicao': 'edit_note',
            'exclusao': 'delete',
            'upload': 'cloud_upload',
        };
        return map[tipo] || 'info';
    }

    // ==========================================
    // BUSCA RELACIONAL (usando EcoBackend.search)
    // ==========================================
    function setupRelationalSearch() {
        const searchInput = document.getElementById('global-search');
        const searchPanel = document.getElementById('search-results');
        if (!searchInput || !searchPanel) return;

        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                searchPanel.classList.add('hidden');
                searchPanel.innerHTML = '';
                return;
            }

            debounceTimer = setTimeout(async () => {
                // Loading state
                searchPanel.innerHTML = `
                    <div class="px-4 py-4 text-center">
                        <span class="material-symbols-outlined animate-spin text-primary text-[20px]">progress_activity</span>
                        <p class="text-xs text-slate-500 mt-2">Buscando em todas as bases...</p>
                    </div>
                `;
                searchPanel.classList.remove('hidden');

                try {
                    // Busca com sugestões contextuais
                    const { resultados, tips } = await EcoQueries.busca.sugestoes(query);

                    if (resultados.length > 0) {
                        let html = resultados.map(m => `
                            <div class="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 rounded-lg transition-colors group">
                                <div class="p-2 rounded-lg bg-white/5 ${m.color} group-hover:bg-white/10 transition-colors shrink-0">
                                    <span class="material-symbols-outlined text-[18px]">${m.icon}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-bold text-slate-200 truncate">${highlightMatch(m.name, query)}</p>
                                    <p class="text-[10px] text-slate-500 uppercase font-semibold truncate">${m.type} • ${m.detail || ''}</p>
                                </div>
                                <span class="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                            </div>
                        `).join('');

                        // Adicionar dicas contextuais
                        if (tips.length > 0) {
                            html += `<div class="border-t border-white/5 mt-1 pt-2">`;
                            tips.forEach(tip => {
                                html += `<p class="px-4 py-1.5 text-xs text-slate-400">${tip}</p>`;
                            });
                            html += `</div>`;
                        }

                        searchPanel.innerHTML = html;
                    } else {
                        let html = `<div class="px-4 py-4 text-center">
                            <span class="material-symbols-outlined text-slate-600 text-3xl mb-2">search_off</span>
                            <p class="text-sm text-slate-400">Nenhum resultado para "<strong class="text-slate-200">${query}</strong>"</p>
                        </div>`;

                        if (tips.length > 0) {
                            html += `<div class="border-t border-white/5 pt-2">`;
                            tips.forEach(tip => {
                                html += `<p class="px-4 py-1.5 text-xs text-slate-400">${tip}</p>`;
                            });
                            html += `</div>`;
                        }

                        searchPanel.innerHTML = html;
                    }
                } catch (err) {
                    searchPanel.innerHTML = `<div class="px-4 py-4 text-center text-sm text-red-400">Erro na busca</div>`;
                }
            }, 300);
        });

        // Keyboard shortcut (Cmd+K / Ctrl+K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
            if (e.key === 'Escape') {
                searchPanel.classList.add('hidden');
                searchInput.blur();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchPanel.contains(e.target)) {
                searchPanel.classList.add('hidden');
            }
        });
    }

    function highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ==========================================
    // NOTIFICAÇÕES
    // ==========================================
    async function setupNotifications() {
        const btn = document.getElementById('btn-notifications');
        const panel = document.getElementById('notification-panel');
        const badge = document.getElementById('notification-badge');
        const list = document.getElementById('notification-list');

        if (!btn || !panel) return;

        // Carregar dados de notificação (licenças vencendo, financeiro atrasado)
        const notifications = await buildNotifications();

        if (notifications.length > 0) {
            badge.textContent = notifications.length;
            badge.classList.remove('hidden');
        }

        list.innerHTML = notifications.length > 0
            ? notifications.map(n => `
                <div class="notification-item">
                    <div class="flex items-start gap-3">
                        <span class="p-2 rounded-lg ${n.bgClass} shrink-0 mt-0.5">
                            <span class="material-symbols-outlined text-[16px] ${n.colorClass}">${n.icon}</span>
                        </span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-200">${n.title}</p>
                            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">${n.description}</p>
                            <p class="text-[10px] text-slate-600 mt-1.5">${n.time}</p>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<p class="text-center text-slate-500 text-sm py-8">Nenhuma notificação</p>';

        // Toggle panel
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !btn.contains(e.target)) {
                panel.classList.add('hidden');
            }
        });
    }

    async function buildNotifications() {
        const notifications = [];

        try {
            // Licenças vencendo em 30 dias
            const vencendo = await EcoQueries.licencas.vencendoEm(30);
            vencendo.forEach(l => {
                const dias = EcoBackend.getDaysUntil(l.vencimento || l.data_vencimento);
                notifications.push({
                    icon: 'event_busy',
                    title: l.titulo,
                    description: `Vence em ${dias} dias • ${l.orgao || 'Órgão não informado'}`,
                    time: `Vencimento: ${EcoBackend.formatDate(l.vencimento || l.data_vencimento)}`,
                    bgClass: 'bg-red-500/15',
                    colorClass: 'text-red-400',
                });
            });

            // Licenças vencidas
            const vencidas = await EcoQueries.licencas.vencidas();
            vencidas.forEach(l => {
                notifications.push({
                    icon: 'warning',
                    title: `${l.titulo} — VENCIDA`,
                    description: `Licença expirou! Processo: ${l.processo}`,
                    time: `Venceu: ${EcoBackend.formatDate(l.vencimento || l.data_vencimento)}`,
                    bgClass: 'bg-red-500/15',
                    colorClass: 'text-red-400',
                });
            });

            // Financeiro atrasado
            const financeiro = await EcoQueries.financeiro.listar({ status: 'atrasado' });
            (Array.isArray(financeiro) ? financeiro : []).forEach(f => {
                if (f.status === 'atrasado') {
                    notifications.push({
                        icon: 'payments',
                        title: `Pagamento atrasado — ${f.cliente}`,
                        description: `${f.categoria}: ${EcoBackend.formatCurrency(f.valor)}`,
                        time: `Data: ${EcoBackend.formatDate(f.data)}`,
                        bgClass: 'bg-yellow-500/15',
                        colorClass: 'text-yellow-400',
                    });
                }
            });
        } catch (err) {
            console.error('Erro ao construir notificações:', err);
        }

        return notifications;
    }

    // ==========================================
    // AI INSIGHT (via EcoIntelligence Engine)
    // ==========================================
    async function updateAIInsight(stats) {
        const el = document.getElementById('ai-tip');
        if (!el) return;

        let insights = [];

        try {
            // Usar motor de inteligência relacional
            if (window.EcoIntelligence) {
                insights = await EcoIntelligence.gerarDicasContextuais();
            }
        } catch (err) {
            console.warn('Intelligence engine fallback:', err);
        }

        // Fallback se inteligência não disponível
        if (insights.length === 0) {
            if (stats.vencendo30d > 3) {
                insights.push(`Atenção: ${stats.vencendo30d} licenças vencem nos próximos 30 dias.`);
            }
            if (stats.vencidas > 0) {
                insights.push(`⚠️ ${stats.vencidas} licença(s) vencida(s). Risco de multa.`);
            }
            if (insights.length === 0) {
                insights.push('Todos os processos estão em conformidade.');
            }
        }

        // Rotate insights every 8 seconds
        let currentIndex = 0;
        el.textContent = insights[currentIndex];

        if (insights.length > 1) {
            setInterval(() => {
                currentIndex = (currentIndex + 1) % insights.length;
                el.style.opacity = '0';
                el.style.transform = 'translateY(4px)';
                setTimeout(() => {
                    el.textContent = insights[currentIndex];
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 300);
            }, 8000);
        }

        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    }

    // ==========================================
    // HELPERS
    // ==========================================
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) return `Há ${diffHours}h`;
        if (diffDays < 7) return `Há ${diffDays} dia(s)`;
        return date.toLocaleDateString('pt-BR');
    }

    function formatDateFull(date) {
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    function showToast(msg, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: type,
                title: msg,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                background: '#0f1712',
                color: '#e2e8f0',
            });
        }
    }
});
