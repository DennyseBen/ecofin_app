// =============================================
// licencas.js — Gestão de Licenças
// Refatorado: sem Tailwind, compatível com novo tema
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await EcoBackend.checkSession();
    if (!session) { window.location.href = 'index.html'; return; }
    renderUserInfo(session);
    await carregarLicencas();
    setupModalNovaLicenca();
    setupSearch();
});

let allLicencas = [];
let allClientes = [];

async function carregarLicencas() {
    try {
        allLicencas = await EcoBackend.getLicencas();
        allClientes = await EcoBackend.getClientes();
        atualizarKPIs(allLicencas);
        renderLicencas(allLicencas);
    } catch (e) {
        console.error('Erro:', e);
        showToast('Erro ao carregar licenças', 'error');
    }
}

function atualizarKPIs(licencas) {
    const vigentes = licencas.filter(l => l.status === 'vigente').length;
    const vencidas = licencas.filter(l => l.status === 'vencida').length;
    const renovando = licencas.filter(l => l.status === 'renovando').length;
    const exigencia = licencas.filter(l => l.status === 'em_analise' || l.status === 'exigencia').length;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-vigentes', vigentes);
    set('kpi-vencidas', vencidas);
    set('kpi-renovando', renovando);
    set('kpi-exigencia', exigencia);
}

function renderLicencas(licencas) {
    const tbody = document.getElementById('licencas-tbody');
    if (!tbody) return;

    if (!licencas.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><div class="empty-state"><i data-lucide="badge-check"></i><p>Nenhuma licença encontrada</p></div></td></tr>';
        return;
    }

    const statusBadge = s => {
        const map = { vigente: 'badge-green', vencida: 'badge-red', renovando: 'badge-yellow', em_analise: 'badge-blue', exigencia: 'badge-yellow' };
        return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
    };

    tbody.innerHTML = licencas.map(l => {
        const dias = EcoBackend.getDaysUntil ? EcoBackend.getDaysUntil(l.vencimento) : calcDias(l.vencimento);
        const cliente = allClientes.find(c => c.id === l.cliente_id);
        return `<tr>
            <td><div class="font-semibold text-sm">${l.titulo}</div><div class="text-xs text-muted">${l.tipo || '—'}</div></td>
            <td class="text-sm">${l.processo || '—'}</td>
            <td><span class="badge badge-blue">${l.orgao}</span></td>
            <td class="text-sm">${formatDate(l.vencimento)} <span class="text-xs text-muted">(${dias}d)</span></td>
            <td>${statusBadge(l.status)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="openLicencaDetail(${l.id})"><i data-lucide="external-link" style="font-size:16px"></i></button></td>
        </tr>`;
    }).join('');
}

function calcDias(data) {
    if (!data) return '—';
    const diff = (new Date(data) - new Date()) / (1000 * 60 * 60 * 24);
    return Math.round(diff);
}

function setupSearch() {
    const input = document.getElementById('search-licencas');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();
            const filtered = q ? allLicencas.filter(l => `${l.titulo} ${l.processo} ${l.orgao} ${l.tipo} ${l.status}`.toLowerCase().includes(q)) : allLicencas;
            renderLicencas(filtered);
        }, 300);
    });
}

window.openLicencaDetail = function (id) {
    const l = allLicencas.find(x => x.id === id);
    if (!l) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const cliente = allClientes.find(c => c.id === l.cliente_id);

    Swal.fire({
        title: '', html: `<div style="text-align:left">
            <h2 class="font-bold text-lg mb-1">${l.titulo}</h2>
            <p class="text-sm text-muted mb-4">${l.tipo || '—'} — ${l.orgao}</p>
            <div class="grid gap-3 mb-4" style="grid-template-columns:1fr 1fr">
                <div style="padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="text-xs text-muted font-semibold mb-1">Processo</div><div class="text-sm font-bold">${l.processo || '—'}</div></div>
                <div style="padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="text-xs text-muted font-semibold mb-1">Vencimento</div><div class="text-sm font-bold">${formatDate(l.vencimento)}</div></div>
                <div style="padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="text-xs text-muted font-semibold mb-1">Cliente</div><div class="text-sm font-bold">${l.cliente_nome || cliente?.nome || '—'}</div></div>
                <div style="padding:12px;border-radius:8px;background:var(--bg-hover)"><div class="text-xs text-muted font-semibold mb-1">Status</div><div class="text-sm font-bold">${l.status}</div></div>
            </div>
        </div>`,
        background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a', width: 480,
        showConfirmButton: false, showCloseButton: true,
    });
};

function setupModalNovaLicenca() {
    document.getElementById('btn-nova-licenca')?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const clienteOpts = allClientes.map(c => `<option value="${c.id}">${c.nome || c.razao_social}</option>`).join('');
        Swal.fire({
            title: 'Nova Licença', html: `<div style="text-align:left;display:flex;flex-direction:column;gap:12px">
                <div><label class="form-label">Título *</label><input id="swal-titulo" class="form-input" placeholder="Ex: LO - Mineração"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">Tipo</label><select id="swal-tipo" class="form-select"><option value="LP">LP</option><option value="LI">LI</option><option value="LO">LO</option><option value="LAU">LAU</option><option value="CADRI">CADRI</option></select></div><div><label class="form-label">Órgão</label><input id="swal-orgao" class="form-input" placeholder="IBAMA"></div></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="form-label">Nº Processo</label><input id="swal-proc" class="form-input" placeholder="123/2026"></div><div><label class="form-label">Vencimento</label><input id="swal-venc" type="date" class="form-input"></div></div>
                <div><label class="form-label">Cliente</label><select id="swal-cli" class="form-select"><option value="">Selecione...</option>${clienteOpts}</select></div>
            </div>`,
            background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a',
            confirmButtonText: 'Cadastrar', confirmButtonColor: '#16a34a', showCancelButton: true, cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const titulo = document.getElementById('swal-titulo')?.value?.trim();
                if (!titulo) { Swal.showValidationMessage('Título é obrigatório'); return false; }
                return { titulo, tipo: document.getElementById('swal-tipo')?.value, orgao: document.getElementById('swal-orgao')?.value?.trim() || 'IBAMA', processo: document.getElementById('swal-proc')?.value?.trim(), vencimento: document.getElementById('swal-venc')?.value, cliente_id: parseInt(document.getElementById('swal-cli')?.value) || null, status: 'vigente' };
            }
        }).then(r => {
            if (r.isConfirmed && r.value) {
                const c = allClientes.find(x => x.id === r.value.cliente_id);
                allLicencas.push({ id: Date.now(), ...r.value, cliente_nome: c?.nome || '—' });
                atualizarKPIs(allLicencas);
                renderLicencas(allLicencas);
                showToast('Licença cadastrada!', 'success');
            }
        });
    });
}
