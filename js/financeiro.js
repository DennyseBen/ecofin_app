// =============================================
// financeiro.js — Gestão Financeira
// Refatorado: sem Tailwind, compatível com novo tema
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await EcoBackend.checkSession();
    if (!session) { window.location.href = 'index.html'; return; }
    renderUserInfo(session);
    await loadFinanceiroData();
    setupFilters();
    setupSearch();
    setupPagination();
    setupModalNovaTransacao();
});

let allTransacoes = [];
let filteredTransacoes = [];
let currentFilter = 'todos';
let currentSearch = '';
let currentPage = 1;
const PAGE_SIZE = 8;

async function loadFinanceiroData() {
    try {
        const financeiro = await EcoBackend.getFinanceiro();
        allTransacoes = financeiro.sort((a, b) => new Date(b.data) - new Date(a.data));
        filteredTransacoes = [...allTransacoes];
        updateKPIs(allTransacoes);
        renderCharts(allTransacoes);
        renderTable();
    } catch (err) {
        console.error('Erro:', err);
        showToast('Erro ao carregar dados financeiros', 'error');
    }
}

function updateKPIs(data) {
    const receitas = data.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesas = data.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
    const pendentes = data.filter(t => t.status === 'pendente').reduce((s, t) => s + t.valor, 0);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(v); };
    set('kpi-receitas', receitas);
    set('kpi-despesas', despesas);
    set('kpi-saldo', receitas - despesas);
    set('kpi-pendentes', pendentes);
}

function renderCharts(data) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Group by month
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        months[key] = { receita: 0, despesa: 0 };
    }
    data.forEach(t => {
        const d = new Date(t.data);
        const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if (months[key]) { if (t.tipo === 'receita') months[key].receita += t.valor; else months[key].despesa += t.valor; }
    });
    const labels = Object.keys(months);

    // Bar chart
    const ctx1 = document.getElementById('chart-receita-despesa');
    if (ctx1) {
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels, datasets: [
                    { label: 'Receita', data: labels.map(k => months[k].receita), backgroundColor: '#16a34a', borderRadius: 6, borderSkipped: false },
                    { label: 'Despesa', data: labels.map(k => months[k].despesa), backgroundColor: '#dc2626', borderRadius: 6, borderSkipped: false }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` } } }, scales: { x: { ticks: { color: textColor }, grid: { display: false } }, y: { ticks: { color: textColor, callback: v => (v / 1000).toFixed(0) + 'k' }, grid: { color: gridColor } } } }
        });
    }

    // Donut
    const categorias = {};
    data.filter(t => t.tipo === 'receita').forEach(t => { categorias[t.categoria] = (categorias[t.categoria] || 0) + t.valor; });
    const catLabels = Object.keys(categorias);
    const catValues = Object.values(categorias);
    const ctx2 = document.getElementById('chart-categoria');
    if (ctx2) {
        new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: ['#16a34a', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 12 } } } }
        });
    }
}

function setupFilters() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => { b.classList.remove('filter-active'); b.classList.add('btn-ghost'); });
            btn.classList.add('filter-active');
            btn.classList.remove('btn-ghost');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            applyFilters();
        });
    });
}

function setupSearch() {
    const input = document.getElementById('search-financeiro');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { currentSearch = input.value.trim().toLowerCase(); currentPage = 1; applyFilters(); }, 300);
    });
}

function applyFilters() {
    filteredTransacoes = allTransacoes.filter(t => {
        if (currentFilter === 'receita' && t.tipo !== 'receita') return false;
        if (currentFilter === 'despesa' && t.tipo !== 'despesa') return false;
        if (currentFilter === 'pago' && t.status !== 'pago') return false;
        if (currentFilter === 'pendente' && t.status !== 'pendente') return false;
        if (currentSearch) {
            const str = `${t.descricao} ${t.cliente} ${t.categoria}`.toLowerCase();
            if (!str.includes(currentSearch)) return false;
        }
        return true;
    });
    renderTable();
}

function setupPagination() {
    document.getElementById('btn-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    document.getElementById('btn-next')?.addEventListener('click', () => { const tp = Math.ceil(filteredTransacoes.length / PAGE_SIZE); if (currentPage < tp) { currentPage++; renderTable(); } });
}

function renderTable() {
    const tbody = document.getElementById('financeiro-tbody');
    if (!tbody) return;

    const totalPages = Math.max(1, Math.ceil(filteredTransacoes.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredTransacoes.slice(start, start + PAGE_SIZE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="empty-state"><i data-lucide="receipt"></i><p>Nenhuma transação encontrada</p></div></td></tr>';
    } else {
        tbody.innerHTML = page.map(t => {
            const isR = t.tipo === 'receita';
            const val = t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const data = new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            return `<tr>
                <td class="text-sm">${data}</td>
                <td class="text-sm font-semibold truncate" style="max-width:200px">${t.descricao}</td>
                <td class="text-sm text-secondary truncate" style="max-width:150px">${t.cliente || '—'}</td>
                <td><span class="badge badge-gray">${t.categoria}</span></td>
                <td style="text-align:right;font-weight:700;color:${isR ? 'var(--primary)' : 'var(--danger)'}">${isR ? '+' : '-'}${val}</td>
                <td><span class="badge ${isR ? 'badge-green' : 'badge-red'}">${isR ? 'Receita' : 'Despesa'}</span></td>
                <td><span class="badge ${t.status === 'pago' ? 'badge-green' : 'badge-yellow'}">${t.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
            </tr>`;
        }).join('');
    }
    const ct = document.getElementById('table-count');
    if (ct) ct.textContent = `Exibindo ${page.length} de ${filteredTransacoes.length}`;
    const pi = document.getElementById('page-info');
    if (pi) pi.textContent = `${currentPage} / ${totalPages}`;
    const bp = document.getElementById('btn-prev');
    const bn = document.getElementById('btn-next');
    if (bp) bp.disabled = currentPage <= 1;
    if (bn) bn.disabled = currentPage >= totalPages;
}

function setupModalNovaTransacao() {
    document.getElementById('btn-nova-transacao')?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        Swal.fire({
            title: 'Nova Transação',
            html: `<div style="text-align:left;display:flex;flex-direction:column;gap:12px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">Tipo</label><select id="swal-tipo" class="form-select"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></div><div><label class="form-label">Status</label><select id="swal-status" class="form-select"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></div></div>
                <div><label class="form-label">Descrição *</label><input id="swal-desc" class="form-input" placeholder="Ex: Consultoria ambiental"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">Valor (R$)</label><input id="swal-valor" type="number" class="form-input" step="0.01" placeholder="0,00"></div><div><label class="form-label">Data</label><input id="swal-data" type="date" class="form-input"></div></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">Categoria</label><select id="swal-cat" class="form-select"><option>Consultoria</option><option>Licenciamento</option><option>Monitoramento</option><option>Taxa</option><option>Outros</option></select></div><div><label class="form-label">Cliente</label><input id="swal-cli" class="form-input" placeholder="Nome do cliente"></div></div>
            </div>`,
            background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a',
            confirmButtonText: 'Registrar', confirmButtonColor: '#16a34a', showCancelButton: true, cancelButtonText: 'Cancelar',
            didOpen: () => { const d = document.getElementById('swal-data'); if (d) d.value = new Date().toISOString().split('T')[0]; },
            preConfirm: () => {
                const desc = document.getElementById('swal-desc')?.value?.trim();
                const val = parseFloat(document.getElementById('swal-valor')?.value);
                if (!desc) { Swal.showValidationMessage('Informe a descrição'); return false; }
                if (!val || val <= 0) { Swal.showValidationMessage('Informe valor válido'); return false; }
                return { descricao: desc, valor: val, data: document.getElementById('swal-data')?.value, tipo: document.getElementById('swal-tipo')?.value, categoria: document.getElementById('swal-cat')?.value, status: document.getElementById('swal-status')?.value, cliente: document.getElementById('swal-cli')?.value?.trim() || 'N/A' };
            }
        }).then(r => {
            if (r.isConfirmed && r.value) {
                allTransacoes.unshift({ id: Date.now(), ...r.value });
                filteredTransacoes = [...allTransacoes];
                currentPage = 1;
                updateKPIs(allTransacoes);
                applyFilters();
                showToast('Transação registrada!', 'success');
            }
        });
    });
}
