// =============================================
// processos.js — Kanban de Licenciamento Ambiental
// Drag & drop, slide-over com abas, upload de arquivos
// =============================================

const KANBAN_COLUMNS = [
    { id: 'planejamento', title: 'Planejamento e Enquadramento', icon: 'lightbulb', color: '#8b5cf6' },
    { id: 'coleta', title: 'Coleta de Dados e Documentos', icon: 'folder_open', color: '#f59e0b' },
    { id: 'preenchimento', title: 'Preenchimento e Taxas', icon: 'edit_note', color: '#3b82f6' },
    { id: 'protocolado', title: 'Protocolado / Em Análise', icon: 'pending', color: '#06b6d4' },
    { id: 'exigencias', title: 'Exigências e Vistoria', icon: 'warning', color: '#ef4444' },
    { id: 'concluido', title: 'Concluído', icon: 'check_circle', color: '#16a34a' },
];

const STORAGE_KEY = 'ecofin_processos_v2';

let processos = [];
let editingId = null;
let uploadedFiles = [];
let clientes = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const session = await EcoBackend.checkSession();
        if (!session) { window.location.href = 'index.html'; return; }
        renderUserInfo(session);

        clientes = await EcoBackend.getClientes();

        // Force reset storage for debugging
        localStorage.removeItem(STORAGE_KEY);

        loadProcessos();
        renderBoard();
        setupModal();
        setupTabs();
        setupFileUpload();
        generateAIInsight();

        document.getElementById('btn-novo-processo')?.addEventListener('click', () => openModal());
    } catch (e) {
        console.error("DOM ERROR: ", e);
        const b = document.getElementById('kanban-board');
        if (b) b.innerHTML = `<div style="color:red;padding:20px;">ERRO: ${e.message}</div>`;
    }
});

// =============================================
// DATA
// =============================================
function loadProcessos() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { processos = JSON.parse(stored); return; }
    // Seed data
    processos = [
        { id: 'p1', cliente: 'Mineração Vale Verde S.A.', tipo: 'LO', responsavel: 'Carlos M.', prioridade: 'alta', etapa: 'exigencias', protocolo: '12345/2023', orgao: 'IBAMA', obs: 'Aguardando vistoria técnica', dataProtocolo: '2025-08-10', prazo: '2026-04-15', valor: 3200, cnae: '07.10-3', anexos: [], criadoEm: '2025-08-01' },
        { id: 'p2', cliente: 'Energia dos Ventos S.A.', tipo: 'EIA', responsavel: 'Ana L.', prioridade: 'alta', etapa: 'coleta', protocolo: '', orgao: 'IBAMA', obs: 'Falta estudo faunístico', dataProtocolo: '', prazo: '2026-05-20', valor: 15000, cnae: '35.11-5', anexos: [], criadoEm: '2025-09-15' },
        { id: 'p3', cliente: 'Agroindústria Solar Ltda', tipo: 'LI', responsavel: 'Marcos R.', prioridade: 'media', etapa: 'preenchimento', protocolo: '67890/2024', orgao: 'CETESB', obs: 'Boleto pendente', dataProtocolo: '2025-11-20', prazo: '2026-03-30', valor: 1800, cnae: '01.11-3', anexos: [], criadoEm: '2025-10-05' },
        { id: 'p4', cliente: 'BioTech Solutions Inc.', tipo: 'LP', responsavel: 'Rafael P.', prioridade: 'baixa', etapa: 'planejamento', protocolo: '', orgao: '', obs: 'Enquadramento CNAE', dataProtocolo: '', prazo: '', valor: 0, cnae: '20.29-1', anexos: [], criadoEm: '2026-01-10' },
        { id: 'p5', cliente: 'Logística Brasil Ltda', tipo: 'LO', responsavel: 'Fernanda S.', prioridade: 'media', etapa: 'concluido', protocolo: '66701/2023', orgao: 'CETESB', obs: 'Concluído', dataProtocolo: '2025-06-15', prazo: '2025-07-30', valor: 1500, cnae: '49.30-2', anexos: [], criadoEm: '2025-04-10' },
        { id: 'p6', cliente: 'Petrogreen Energy Corp', tipo: 'LO', responsavel: 'André T.', prioridade: 'alta', etapa: 'protocolado', protocolo: '88221/2024', orgao: 'IBAMA', obs: 'Monitoramento trimestral', dataProtocolo: '2025-12-01', prazo: '2026-06-15', valor: 22000, cnae: '06.00-0', anexos: [], criadoEm: '2025-11-20' },
    ];
    saveProcessos();
}

function saveProcessos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(processos));
}

// =============================================
// RENDER BOARD
// =============================================
function renderBoard() {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    KANBAN_COLUMNS.forEach(col => {
        const cards = processos.filter(p => p.etapa === col.id);
        const colEl = document.createElement('div');
        colEl.className = 'kanban-column';
        colEl.innerHTML = `
            <div class="kanban-column-header">
                <div class="kanban-column-title">
                    <span class="material-symbols-outlined" style="font-size:18px;color:${col.color}">${col.icon}</span>
                    <span>${col.title}</span>
                    <span class="kanban-column-count">${cards.length}</span>
                </div>
                <button class="btn-ghost" style="padding:4px" data-add-col="${col.id}" title="Adicionar">
                    <span class="material-symbols-outlined" style="font-size:18px">add</span>
                </button>
            </div>
            <div class="kanban-column-body" data-column="${col.id}">
                ${cards.map(c => renderCard(c)).join('')}
                ${cards.length === 0 ? '<div class="empty-state"><span class="material-symbols-outlined">inbox</span><p class="text-xs">Nenhum processo</p></div>' : ''}
            </div>
        `;
        board.appendChild(colEl);
    });

    setupDragDrop();
    setupCardClicks();
    document.querySelectorAll('[data-add-col]').forEach(btn => {
        btn.addEventListener('click', () => openModal(null, btn.dataset.addCol));
    });
}

function renderCard(p) {
    const prioClass = { alta: 'priority-alta', media: 'priority-media', baixa: 'priority-baixa' }[p.prioridade] || 'priority-media';
    const prioLabel = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[p.prioridade] || 'Média';
    const anexosCount = (p.anexos || []).length;
    return `
        <div class="kanban-card" draggable="true" data-id="${p.id}">
            <div class="flex items-center justify-between mb-1">
                <span class="badge ${prioClass}" style="font-size:10px">${prioLabel}</span>
                <span class="badge badge-gray" style="font-size:10px">${p.tipo}</span>
            </div>
            <div class="kanban-card-title">${p.cliente}</div>
            <div class="kanban-card-client">${p.responsavel || '—'}</div>
            <div class="kanban-card-footer">
                <div class="kanban-card-tags">
                    ${p.orgao ? `<span class="badge badge-blue" style="font-size:10px">${p.orgao}</span>` : ''}
                    ${anexosCount > 0 ? `<span class="badge badge-gray" style="font-size:10px"><span class="material-symbols-outlined" style="font-size:12px">attach_file</span>${anexosCount}</span>` : ''}
                </div>
                <span class="text-xs text-muted">${p.protocolo || '—'}</span>
            </div>
        </div>
    `;
}

// =============================================
// DRAG & DROP
// =============================================
function setupDragDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const zones = document.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
        card.addEventListener('dragstart', e => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            zones.forEach(z => z.classList.remove('drag-over'));
        });
    });

    zones.forEach(zone => {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const targetCol = zone.dataset.column;
            const proc = processos.find(p => p.id === id);
            if (proc && proc.etapa !== targetCol) {
                proc.etapa = targetCol;
                saveProcessos();
                renderBoard();
                const colName = KANBAN_COLUMNS.find(c => c.id === targetCol)?.title || targetCol;
                showToast(`Processo movido para "${colName}"`, 'success');
            }
        });
    });
}

function setupCardClicks() {
    document.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('[draggable]') && !e.defaultPrevented) {
                openModal(card.dataset.id);
            }
        });
    });
}

// =============================================
// MODAL / SLIDE-OVER
// =============================================
function setupModal() {
    const overlay = document.getElementById('processo-modal');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-processo').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('btn-save-processo').addEventListener('click', saveProcesso);

    // Populate client select
    const sel = document.getElementById('proc-cliente');
    sel.innerHTML = '<option value="">Selecione...</option>' + clientes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');

    // Populate etapa select
    const etapaSel = document.getElementById('proc-etapa');
    etapaSel.innerHTML = KANBAN_COLUMNS.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

function openModal(procId = null, defaultEtapa = 'planejamento') {
    const overlay = document.getElementById('processo-modal');
    editingId = procId;
    uploadedFiles = [];

    if (procId) {
        const p = processos.find(x => x.id === procId);
        if (!p) return;
        document.getElementById('modal-title').textContent = 'Editar Processo';
        document.getElementById('modal-subtitle').textContent = `${p.tipo} — ${p.cliente}`;
        document.getElementById('proc-cliente').value = p.cliente;
        document.getElementById('proc-tipo').value = p.tipo;
        document.getElementById('proc-responsavel').value = p.responsavel || '';
        document.getElementById('proc-prioridade').value = p.prioridade;
        document.getElementById('proc-etapa').value = p.etapa;
        document.getElementById('proc-obs').value = p.obs || '';
        document.getElementById('proc-protocolo').value = p.protocolo || '';
        document.getElementById('proc-orgao').value = p.orgao || '';
        document.getElementById('proc-data-protocolo').value = p.dataProtocolo || '';
        document.getElementById('proc-prazo').value = p.prazo || '';
        document.getElementById('proc-valor').value = p.valor || '';
        document.getElementById('proc-cnae').value = p.cnae || '';
        uploadedFiles = [...(p.anexos || [])];
    } else {
        document.getElementById('modal-title').textContent = 'Novo Processo';
        document.getElementById('modal-subtitle').textContent = 'Preencha os dados do processo';
        document.getElementById('proc-cliente').value = '';
        document.getElementById('proc-tipo').value = '';
        document.getElementById('proc-responsavel').value = '';
        document.getElementById('proc-prioridade').value = 'media';
        document.getElementById('proc-etapa').value = defaultEtapa;
        document.getElementById('proc-obs').value = '';
        document.getElementById('proc-protocolo').value = '';
        document.getElementById('proc-orgao').value = '';
        document.getElementById('proc-data-protocolo').value = '';
        document.getElementById('proc-prazo').value = '';
        document.getElementById('proc-valor').value = '';
        document.getElementById('proc-cnae').value = '';
    }

    renderFileList();
    switchTab('dados');
    overlay.classList.add('open');
}

function closeModal() {
    document.getElementById('processo-modal').classList.remove('open');
    editingId = null;
    uploadedFiles = [];
}

function saveProcesso() {
    const cliente = document.getElementById('proc-cliente').value;
    const tipo = document.getElementById('proc-tipo').value;
    if (!cliente || !tipo) { showToast('Preencha Cliente e Tipo de Licença', 'warning'); return; }

    const data = {
        cliente,
        tipo,
        responsavel: document.getElementById('proc-responsavel').value,
        prioridade: document.getElementById('proc-prioridade').value,
        etapa: document.getElementById('proc-etapa').value,
        obs: document.getElementById('proc-obs').value,
        protocolo: document.getElementById('proc-protocolo').value,
        orgao: document.getElementById('proc-orgao').value,
        dataProtocolo: document.getElementById('proc-data-protocolo').value,
        prazo: document.getElementById('proc-prazo').value,
        valor: parseFloat(document.getElementById('proc-valor').value) || 0,
        cnae: document.getElementById('proc-cnae').value,
        anexos: uploadedFiles,
    };

    if (editingId) {
        const idx = processos.findIndex(p => p.id === editingId);
        if (idx !== -1) processos[idx] = { ...processos[idx], ...data };
        showToast('Processo atualizado', 'success');
    } else {
        data.id = 'p' + Date.now();
        data.criadoEm = new Date().toISOString().split('T')[0];
        processos.push(data);
        showToast('Processo criado com sucesso', 'success');
    }

    saveProcessos();
    renderBoard();
    closeModal();
}

// =============================================
// TABS
// =============================================
function setupTabs() {
    document.querySelectorAll('#modal-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(tabId) {
    document.querySelectorAll('#modal-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabId));
}

// =============================================
// FILE UPLOAD
// =============================================
function setupFileUpload() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');
    const ALLOWED = ['.pdf', '.xlsx', '.csv'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

    function handleFiles(files) {
        Array.from(files).forEach(f => {
            const ext = '.' + f.name.split('.').pop().toLowerCase();
            if (!ALLOWED.includes(ext)) { showToast(`Arquivo "${f.name}" não é permitido. Use .pdf, .xlsx ou .csv`, 'warning'); return; }
            if (f.size > MAX_SIZE) { showToast(`Arquivo "${f.name}" muito grande (máx. 10MB)`, 'warning'); return; }

            // Store as metadata (real upload would go to Supabase Storage)
            const etapaAtual = document.getElementById('proc-etapa').value;
            const etapaLabel = KANBAN_COLUMNS.find(c => c.id === etapaAtual)?.title || etapaAtual;
            uploadedFiles.push({
                name: f.name,
                size: f.size,
                type: ext,
                uploadedAt: new Date().toISOString(),
                etapa: etapaLabel,
            });
            showToast(`"${f.name}" adicionado`, 'success');
        });
        renderFileList();
    }
}

function renderFileList() {
    const list = document.getElementById('file-list');
    if (!uploadedFiles.length) { list.innerHTML = ''; return; }

    const icons = { '.pdf': 'picture_as_pdf', '.xlsx': 'table_chart', '.csv': 'description' };
    list.innerHTML = uploadedFiles.map((f, i) => `
        <div class="file-item">
            <span class="material-symbols-outlined">${icons[f.type] || 'description'}</span>
            <div class="file-item-info">
                <div class="file-item-name">${f.name}</div>
                <div class="file-item-meta">${formatFileSize(f.size)} • ${new Date(f.uploadedAt).toLocaleDateString('pt-BR')} • <span class="badge badge-blue" style="font-size:10px">${f.etapa}</span></div>
            </div>
            <button class="btn-ghost" onclick="removeFile(${i})" title="Remover"><span class="material-symbols-outlined" style="font-size:16px;color:var(--danger)">delete</span></button>
        </div>
    `).join('');
}

function removeFile(idx) {
    uploadedFiles.splice(idx, 1);
    renderFileList();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// =============================================
// AI INSIGHTS (Free - uses local intelligence.js)
// =============================================
async function generateAIInsight() {
    const banner = document.getElementById('ai-banner');
    const textEl = document.getElementById('ai-banner-text');
    if (!banner || !textEl) return;

    try {
        const total = processos.length;
        const emExigencia = processos.filter(p => p.etapa === 'exigencias').length;
        const concluidos = processos.filter(p => p.etapa === 'concluido').length;
        const semProtocolo = processos.filter(p => !p.protocolo && p.etapa !== 'planejamento' && p.etapa !== 'coleta').length;
        const altaPrio = processos.filter(p => p.prioridade === 'alta' && p.etapa !== 'concluido').length;

        const insights = [];
        if (emExigencia > 0) insights.push(`${emExigencia} processo(s) com exigências pendentes que precisam de atenção imediata.`);
        if (semProtocolo > 0) insights.push(`${semProtocolo} processo(s) sem número de protocolo — verifique se já foram protocolados.`);
        if (altaPrio > 0) insights.push(`${altaPrio} processo(s) de alta prioridade em andamento.`);
        if (concluidos > 0) insights.push(`${concluidos} de ${total} processos concluídos (${Math.round(concluidos / total * 100)}% de taxa de conclusão).`);

        const prazosProximos = processos.filter(p => {
            if (!p.prazo || p.etapa === 'concluido') return false;
            const diff = (new Date(p.prazo) - new Date()) / (1000 * 60 * 60 * 24);
            return diff > 0 && diff < 30;
        });
        if (prazosProximos.length > 0) insights.push(`⚠️ ${prazosProximos.length} processo(s) com prazo vencendo nos próximos 30 dias.`);

        if (insights.length > 0) {
            textEl.textContent = insights[Math.floor(Math.random() * insights.length)];
            banner.style.display = 'flex';
        }
    } catch (e) {
        console.warn('AI insight error:', e);
    }
}
