// =============================================
// pipeline.js — Pipeline Kanban para Licenças
// Drag & drop vanilla com dados do EcoBackend
// =============================================

document.addEventListener('DOMContentLoaded', async () => {

    // Verificar sessão
    const session = await EcoBackend.checkSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Renderizar info do usuário
    renderUserInfo(session);

    // Carregar dados
    const kanban = await EcoBackend.getKanban();
    const clientes = await EcoBackend.getClientes();

    // Estado do board
    const columns = [
        { id: 'doc_pendente', title: 'Documentação Pendente', icon: 'folder_open', color: 'text-amber-400' },
        { id: 'em_analise', title: 'Em Análise', icon: 'pending', color: 'text-blue-400' },
        { id: 'exigencia', title: 'Exigência', icon: 'warning', color: 'text-red-400' },
        { id: 'aprovado', title: 'Aprovado', icon: 'check_circle', color: 'text-emerald-400' },
    ];

    let boardData = {};
    columns.forEach(col => {
        boardData[col.id] = (kanban[col.id] || []).map(item => ({ ...item }));
    });

    // Drag state
    let draggedCard = null;
    let draggedFrom = null;
    let draggedIndex = null;

    // Renderizar board
    function renderBoard() {
        const container = document.getElementById('columns-container');
        container.innerHTML = '';

        columns.forEach(col => {
            const cards = boardData[col.id] || [];
            const colEl = document.createElement('div');
            colEl.className = 'kanban-column flex flex-col';
            colEl.innerHTML = `
                <div class="glass-panel rounded-t-2xl p-4 border-b border-white/5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined ${col.color} text-[20px]">${col.icon}</span>
                            <h3 class="text-sm font-bold text-slate-200">${col.title}</h3>
                            <span class="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-slate-400">${cards.length}</span>
                        </div>
                        <button class="btn-add-card text-slate-500 hover:text-primary transition-colors p-1 rounded-lg hover:bg-white/5"
                                data-column="${col.id}" title="Adicionar cartão">
                            <span class="material-symbols-outlined text-[18px]">add</span>
                        </button>
                    </div>
                </div>
                <div class="column-drop-zone glass-panel rounded-b-2xl flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar"
                     data-column="${col.id}">
                    ${cards.map((card, idx) => renderCard(card, col.id, idx)).join('')}
                </div>
                <button class="btn-add-card-bottom mt-2 w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-xl transition-colors border border-dashed border-white/10 hover:border-white/20"
                        data-column="${col.id}">
                    <span class="material-symbols-outlined text-[14px]">add</span>
                    Adicionar Cartão
                </button>
            `;
            container.appendChild(colEl);
        });

        // Setup events
        setupDragEvents();
        setupAddButtons();
    }

    function renderCard(card, columnId, index) {
        const priorityMap = {
            alta: { label: 'Alta', class: 'priority-high' },
            media: { label: 'Média', class: 'priority-medium' },
            baixa: { label: 'Baixa', class: 'priority-low' },
        };
        const p = priorityMap[card.prioridade] || priorityMap.baixa;
        const tags = (card.tags || []).map(t =>
            `<span class="text-[9px] font-bold bg-white/8 px-1.5 py-0.5 rounded text-slate-400">${t}</span>`
        ).join('');

        return `
            <div class="kanban-card glass-panel rounded-xl p-4 border border-white/5 group"
                 draggable="true" data-card-id="${card.id}" data-column="${columnId}" data-index="${index}">
                <div class="flex items-start justify-between mb-2 gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${p.class}">${p.label}</span>
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="btn-edit-card text-slate-500 hover:text-primary p-1 rounded transition-colors" data-card-id="${card.id}" data-column="${columnId}">
                            <span class="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button class="btn-archive-card text-slate-500 hover:text-yellow-400 p-1 rounded transition-colors" data-card-id="${card.id}" data-column="${columnId}">
                            <span class="material-symbols-outlined text-[14px]">archive</span>
                        </button>
                    </div>
                </div>
                <h4 class="text-sm font-semibold text-white mb-1">${card.titulo}</h4>
                <p class="text-xs text-slate-400 mb-3">${card.cliente}</p>
                ${card.alerta ? `<div class="text-[10px] text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5 mb-3 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[12px]">warning</span>
                    ${card.alerta}
                </div>` : ''}
                <div class="flex items-center justify-between pt-2 border-t border-white/5">
                    <div class="flex items-center gap-1.5">${tags}</div>
                    <span class="text-[10px] text-slate-500">${card.atualizado}</span>
                </div>
            </div>
        `;
    }

    // Drag & Drop
    function setupDragEvents() {
        const cards = document.querySelectorAll('.kanban-card');
        const dropZones = document.querySelectorAll('.column-drop-zone');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedCard = card;
                draggedFrom = card.dataset.column;
                draggedIndex = parseInt(card.dataset.index);
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.cardId);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                dropZones.forEach(z => z.classList.remove('drag-over'));
                draggedCard = null;
                draggedFrom = null;
                draggedIndex = null;
            });
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const targetColumn = zone.dataset.column;
                const cardId = parseInt(e.dataTransfer.getData('text/plain'));

                if (draggedFrom && targetColumn && draggedFrom !== targetColumn) {
                    // Mover card entre colunas
                    const cardIdx = boardData[draggedFrom].findIndex(c => c.id === cardId);
                    if (cardIdx !== -1) {
                        const [card] = boardData[draggedFrom].splice(cardIdx, 1);
                        boardData[targetColumn].push(card);
                        showToast(`Cartão movido para "${columns.find(c => c.id === targetColumn)?.title}"`, 'success');
                        renderBoard();
                    }
                }
            });
        });

        // Edit & Archive buttons
        document.querySelectorAll('.btn-edit-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.dataset.cardId);
                const colId = btn.dataset.column;
                const card = boardData[colId]?.find(c => c.id === cardId);
                if (card) openEditModal(card, colId);
            });
        });

        document.querySelectorAll('.btn-archive-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = parseInt(btn.dataset.cardId);
                const colId = btn.dataset.column;
                boardData[colId] = boardData[colId].filter(c => c.id !== cardId);
                showToast('Cartão arquivado', 'success');
                renderBoard();
            });
        });
    }

    function setupAddButtons() {
        document.querySelectorAll('.btn-add-card, .btn-add-card-bottom').forEach(btn => {
            btn.addEventListener('click', () => {
                openNewModal(btn.dataset.column);
            });
        });
    }

    // Modal Nova Tarefa
    function openNewModal(columnId) {
        const colName = columns.find(c => c.id === columnId)?.title || columnId;
        Swal.fire({
            title: 'Novo Cartão',
            html: `
                <div class="text-left space-y-3">
                    <p class="text-xs text-slate-400 mb-3">Coluna: <strong class="text-primary">${colName}</strong></p>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Título *</label>
                        <input id="swal-titulo" class="swal2-input" placeholder="Ex: Renovação LO">
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Cliente *</label>
                        <select id="swal-cliente" class="swal2-select">
                            ${clientes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Prioridade</label>
                        <select id="swal-prioridade" class="swal2-select">
                            <option value="baixa">Baixa</option>
                            <option value="media" selected>Média</option>
                            <option value="alta">Alta</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Tags (separadas por vírgula)</label>
                        <input id="swal-tags" class="swal2-input" placeholder="Ex: IBAMA, LO">
                    </div>
                </div>
            `,
            background: '#0f1712',
            color: '#e2e8f0',
            confirmButtonColor: '#4ade80',
            confirmButtonText: 'Criar Cartão',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'rounded-2xl border border-white/10' },
            preConfirm: () => {
                const titulo = document.getElementById('swal-titulo').value.trim();
                const cliente = document.getElementById('swal-cliente').value;
                if (!titulo) { Swal.showValidationMessage('Título é obrigatório'); return false; }
                return {
                    titulo,
                    cliente,
                    prioridade: document.getElementById('swal-prioridade').value,
                    tags: document.getElementById('swal-tags').value.split(',').map(t => t.trim()).filter(Boolean),
                };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const newCard = {
                    id: Date.now(),
                    titulo: result.value.titulo,
                    cliente: result.value.cliente,
                    prioridade: result.value.prioridade,
                    atualizado: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                    tags: result.value.tags,
                };
                boardData[columnId].push(newCard);
                showToast(`Cartão "${newCard.titulo}" criado com sucesso`, 'success');
                renderBoard();
            }
        });
    }

    function openEditModal(card, columnId) {
        Swal.fire({
            title: 'Editar Cartão',
            html: `
                <div class="text-left space-y-3">
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Título</label>
                        <input id="swal-titulo" class="swal2-input" value="${card.titulo}">
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Cliente</label>
                        <input id="swal-cliente" class="swal2-input" value="${card.cliente}">
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Prioridade</label>
                        <select id="swal-prioridade" class="swal2-select">
                            <option value="baixa" ${card.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
                            <option value="media" ${card.prioridade === 'media' ? 'selected' : ''}>Média</option>
                            <option value="alta" ${card.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Mover para</label>
                        <select id="swal-coluna" class="swal2-select">
                            ${columns.map(c => `<option value="${c.id}" ${c.id === columnId ? 'selected' : ''}>${c.title}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `,
            background: '#0f1712',
            color: '#e2e8f0',
            confirmButtonColor: '#4ade80',
            confirmButtonText: 'Salvar',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'rounded-2xl border border-white/10' },
            preConfirm: () => ({
                titulo: document.getElementById('swal-titulo').value.trim(),
                cliente: document.getElementById('swal-cliente').value.trim(),
                prioridade: document.getElementById('swal-prioridade').value,
                novaColuna: document.getElementById('swal-coluna').value,
            })
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const v = result.value;
                card.titulo = v.titulo || card.titulo;
                card.cliente = v.cliente || card.cliente;
                card.prioridade = v.prioridade;
                card.atualizado = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

                if (v.novaColuna !== columnId) {
                    boardData[columnId] = boardData[columnId].filter(c => c.id !== card.id);
                    boardData[v.novaColuna].push(card);
                }
                showToast('Cartão atualizado', 'success');
                renderBoard();
            }
        });
    }

    // Init
    renderBoard();

    // Desktop new card button
    document.getElementById('btn-novo-card')?.addEventListener('click', () => openNewModal('doc_pendente'));
    document.getElementById('btn-novo-card-mobile')?.addEventListener('click', () => openNewModal('doc_pendente'));

    // Sidebar & Logout
    setupMobileSidebar();
    setupLogout();

    // ---- Helpers ----
    function renderUserInfo(session) {
        const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuário';
        const email = session?.user?.email || '';
        const initials = name.charAt(0).toUpperCase();
        const nameEl = document.getElementById('sidebar-user-name');
        const emailEl = document.getElementById('sidebar-user-email');
        const avatarEl = document.getElementById('sidebar-avatar');
        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;
        if (avatarEl) avatarEl.textContent = initials;
    }

    function setupMobileSidebar() {
        const hamburger = document.getElementById('hamburger-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (hamburger && sidebar) {
            hamburger.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay?.classList.toggle('active');
            });
            overlay?.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    function setupLogout() {
        document.getElementById('btn-logout')?.addEventListener('click', async () => {
            await EcoBackend.logout();
        });
    }

    function showToast(msg, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true, position: 'top-end',
                icon: type, title: msg,
                showConfirmButton: false, timer: 2500, timerProgressBar: true,
                background: '#0f1712', color: '#e2e8f0',
                customClass: { popup: 'rounded-xl border border-white/10' },
            });
        }
    }
});
