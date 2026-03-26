// =============================================
// clientes.js — Gestão de Clientes 360°
// Refatorado: sem Tailwind, compatível com novo tema
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await EcoBackend.checkSession();
    if (!session) { window.location.href = 'index.html'; return; }
    renderUserInfo(session);
    await loadClientes();
    setupSearch();
    setupNovoCliente();
});

let allClientes = [];
let allLicencas = [];
let allFinanceiro = [];

async function loadClientes() {
    try {
        allClientes = await EcoBackend.getClientes();
        allLicencas = await EcoBackend.getLicencas();
        allFinanceiro = await EcoBackend.getFinanceiro();
        updateKPIs();
        renderClientes(allClientes);
    } catch (err) {
        console.error('Erro:', err);
        showToast('Erro ao carregar clientes', 'error');
    }
}

function updateKPIs() {
    const total = allClientes.length;
    const ativos = allClientes.filter(c => c.status === 'ativo').length;
    const inativos = allClientes.filter(c => c.status !== 'ativo').length;
    const clientIds = new Set(allLicencas.map(l => l.cliente_id));
    const comLic = allClientes.filter(c => clientIds.has(c.id)).length;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-total', total);
    set('kpi-ativos', ativos);
    set('kpi-inativos', inativos);
    set('kpi-com-licencas', comLic);
}

function renderClientes(clientes) {
    const grid = document.getElementById('clientes-grid');
    if (!grid) return;

    if (!clientes.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="material-symbols-outlined">group_off</span><p class="font-semibold">Nenhum cliente encontrado</p></div>';
        return;
    }

    grid.innerHTML = clientes.map(c => {
        const licencas = allLicencas.filter(l => l.cliente_id === c.id);
        const fin = allFinanceiro.filter(f => f.cliente_id === c.id);
        const receita = fin.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
        const vigentes = licencas.filter(l => l.status === 'vigente').length;
        const vencidas = licencas.filter(l => l.status === 'vencida').length;
        const nome = c.nome || c.razao_social || '';
        const initials = nome.split(' ').filter(w => w.length > 1).slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const isAtivo = c.status === 'ativo';

        return `
        <div class="card" style="cursor:pointer;transition:all 200ms" onclick="openClienteDetail(${c.id})">
            <div class="card-body">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="sidebar-avatar" style="width:44px;height:44px;font-size:15px">${initials}</div>
                        <div style="min-width:0">
                            <h3 class="font-bold text-sm truncate" style="max-width:180px">${nome}</h3>
                            <p class="text-xs text-muted">${c.tipo || c.setor || '—'} • ${c.cidade || '—'}</p>
                        </div>
                    </div>
                    <span class="badge ${isAtivo ? 'badge-green' : 'badge-red'}">${isAtivo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div class="grid gap-2" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
                    <div style="text-align:center;padding:8px;border-radius:8px;background:var(--bg-hover)">
                        <div class="font-bold">${licencas.length}</div>
                        <div class="text-xs text-muted">Licenças</div>
                    </div>
                    <div style="text-align:center;padding:8px;border-radius:8px;background:var(--bg-hover)">
                        <div class="font-bold text-primary">${vigentes}</div>
                        <div class="text-xs text-muted">Vigentes</div>
                    </div>
                    <div style="text-align:center;padding:8px;border-radius:8px;background:var(--bg-hover)">
                        <div class="font-bold" style="color:${vencidas > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${vencidas}</div>
                        <div class="text-xs text-muted">Vencidas</div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-muted">Receita</span>
                    <span class="font-semibold text-primary">${formatCurrency(receita)}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.openClienteDetail = function (id) {
    const c = allClientes.find(x => x.id === id);
    if (!c) return;
    const licencas = allLicencas.filter(l => l.cliente_id === id);
    const fin = allFinanceiro.filter(f => f.cliente_id === id);
    const receita = fin.filter(f => f.tipo === 'receita').reduce((s, f) => s + f.valor, 0);
    const nome = c.nome || c.razao_social || '';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const licHTML = licencas.length
        ? licencas.map(l => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg-hover)"><div><div class="font-semibold text-sm">${l.titulo}</div><div class="text-xs text-muted">${l.orgao} • ${l.processo}</div></div><span class="badge badge-${l.status === 'vigente' ? 'green' : l.status === 'vencida' ? 'red' : 'yellow'}">${l.status}</span></div>`).join('')
        : '<p class="text-muted text-sm" style="text-align:center;padding:16px">Nenhuma licença</p>';

    Swal.fire({
        title: '', html: `<div style="text-align:left"><div class="flex items-center gap-3 mb-4" style="padding-bottom:16px;border-bottom:1px solid var(--border)"><div class="sidebar-avatar" style="width:48px;height:48px;font-size:18px">${nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}</div><div><h2 class="font-bold text-lg">${nome}</h2><p class="text-xs text-muted">${c.tipo || '—'} • ${c.cidade || '—'}</p></div></div><div class="grid gap-3 mb-4" style="grid-template-columns:1fr 1fr 1fr"><div style="text-align:center;padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="font-bold text-primary">${formatCurrency(receita)}</div><div class="text-xs text-muted">Receitas</div></div><div style="text-align:center;padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="font-bold">${licencas.length}</div><div class="text-xs text-muted">Licenças</div></div><div style="text-align:center;padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="font-bold">${c.cnpj || '—'}</div><div class="text-xs text-muted">CNPJ</div></div></div><h3 class="font-bold text-xs text-muted mb-2" style="text-transform:uppercase;letter-spacing:1px">Licenças Vinculadas</h3>${licHTML}</div>`,
        background: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#0f172a', width: 520,
        showConfirmButton: false, showCloseButton: true,
    });
};

function setupSearch() {
    const input = document.getElementById('search-clientes');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();
            const filtered = q ? allClientes.filter(c => `${c.nome} ${c.cnpj} ${c.cidade} ${c.tipo}`.toLowerCase().includes(q)) : allClientes;
            renderClientes(filtered);
        }, 300);
    });
}

function setupNovoCliente() {
    document.getElementById('btn-novo-cliente')?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        Swal.fire({
            title: 'Novo Cliente', html: `<div style="text-align:left;display:flex;flex-direction:column;gap:12px"><div><label class="form-label">Nome / Razão Social *</label><input id="swal-nome" class="form-input" placeholder="Nome da empresa"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">CNPJ</label><input id="swal-cnpj" class="form-input" placeholder="00.000.000/0001-00"></div><div><label class="form-label">Tipo</label><input id="swal-tipo" class="form-input" placeholder="Ex: Mineração"></div></div><div style="display:grid;grid-template-columns:2fr 1fr;gap:12px"><div><label class="form-label">Cidade</label><input id="swal-cidade" class="form-input" placeholder="São Paulo"></div><div><label class="form-label">Estado</label><input id="swal-uf" class="form-input" placeholder="SP" maxlength="2"></div></div></div>`,
            background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a',
            confirmButtonText: 'Cadastrar', confirmButtonColor: '#16a34a', showCancelButton: true, cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const nome = document.getElementById('swal-nome')?.value?.trim();
                if (!nome) { Swal.showValidationMessage('Nome é obrigatório'); return false; }
                return { nome, cnpj: document.getElementById('swal-cnpj')?.value?.trim(), tipo: document.getElementById('swal-tipo')?.value?.trim(), cidade: document.getElementById('swal-cidade')?.value?.trim(), estado: document.getElementById('swal-uf')?.value?.trim()?.toUpperCase(), status: 'ativo' };
            }
        }).then(r => {
            if (r.isConfirmed && r.value) {
                allClientes.push({ id: Date.now(), ...r.value });
                updateKPIs();
                renderClientes(allClientes);
                showToast('Cliente cadastrado!', 'success');
            }
        });
    });
}
