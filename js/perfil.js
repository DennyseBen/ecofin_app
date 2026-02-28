// =============================================
// perfil.js — Lógica completa da página de perfil
// Upload de foto, edição de dados, preferências
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

    // 1. CHECAGEM DE SESSÃO
    const session = await EcoBackend.checkSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. CARREGAR PERFIL COMPLETO
    const perfil = await EcoBackend.getPerfil();
    renderProfile(perfil, session);

    // 3. SETUP TABS
    setupTabs();

    // 4. SETUP AVATAR UPLOAD
    setupAvatarUpload();

    // 5. SETUP BIO COUNTER
    setupBioCounter();

    // 6. SETUP PASSWORD STRENGTH
    setupPasswordStrength();

    // 7. SETUP SAVE BUTTONS
    setupSaveButtons(perfil);

    // 8. SETUP SIDEBAR MOBILE
    setupMobileSidebar();

    // 9. SETUP LOGOUT
    document.getElementById('btn-logout').addEventListener('click', () => {
        EcoBackend.logout();
    });

    // 10. CARREGAR ATIVIDADES
    await loadActivities();

    // ==========================================
    // RENDER PERFIL
    // ==========================================
    function renderProfile(perfil, session) {
        // Sidebar user info
        const sidebarName = document.getElementById('sidebar-user-name');
        const sidebarEmail = document.getElementById('sidebar-user-email');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        const sidebarAvatarIcon = document.getElementById('sidebar-avatar-icon');

        const nome = perfil.nome_completo || session.user?.name || 'Usuário';
        const email = perfil.email || session.user?.email || '';

        sidebarName.textContent = nome;
        sidebarEmail.textContent = email;

        // Profile header
        document.getElementById('profile-display-name').textContent = nome;
        document.getElementById('profile-display-email').textContent = email;
        document.getElementById('profile-badge-cargo').textContent = perfil.cargo || 'Cargo';
        document.getElementById('profile-badge-dept').textContent = perfil.departamento || 'Departamento';

        // Member since
        if (perfil.criado_em) {
            document.getElementById('profile-since').textContent = new Date(perfil.criado_em).toLocaleDateString('pt-BR', {
                year: 'numeric', month: 'long'
            });
        }

        // Last login
        const lastLogin = document.getElementById('last-login');
        if (lastLogin) {
            lastLogin.textContent = new Date().toLocaleString('pt-BR');
        }

        // Form fields
        document.getElementById('input-nome').value = perfil.nome_completo || '';
        document.getElementById('input-email').value = email;
        document.getElementById('input-telefone').value = perfil.telefone || '';
        document.getElementById('input-cargo').value = perfil.cargo || '';
        document.getElementById('input-empresa').value = perfil.empresa || '';
        document.getElementById('input-bio').value = perfil.bio || '';

        // Department select
        const deptSelect = document.getElementById('input-departamento');
        if (perfil.departamento) {
            for (let opt of deptSelect.options) {
                if (opt.value === perfil.departamento) {
                    opt.selected = true;
                    break;
                }
            }
        }

        // Language select
        const langSelect = document.getElementById('input-idioma');
        if (perfil.idioma) {
            for (let opt of langSelect.options) {
                if (opt.value === perfil.idioma) {
                    opt.selected = true;
                    break;
                }
            }
        }

        // Notification preferences
        setToggle('pref-email', perfil.notificacoes_email);
        setToggle('pref-push', perfil.notificacoes_push);
        setToggle('pref-licenca', perfil.notificacoes_licenca);
        setToggle('pref-financeiro', perfil.notificacoes_financeiro);
        setToggle('pref-2fa', perfil.two_factor);

        // Avatar
        renderAvatar(perfil.avatar_url);

        // Bio counter
        updateBioCounter();
    }

    function renderAvatar(avatarUrl) {
        const profileImg = document.getElementById('profile-avatar-img');
        const profileIcon = document.getElementById('profile-avatar-icon');
        const sidebarImg = document.getElementById('sidebar-avatar');
        const sidebarIcon = document.getElementById('sidebar-avatar-icon');
        const removeBtn = document.getElementById('btn-remove-avatar');

        if (avatarUrl) {
            profileImg.src = avatarUrl;
            profileImg.classList.remove('hidden');
            profileIcon.classList.add('hidden');

            sidebarImg.src = avatarUrl;
            sidebarImg.classList.remove('hidden');
            sidebarIcon.classList.add('hidden');

            removeBtn.classList.remove('hidden');
        } else {
            profileImg.classList.add('hidden');
            profileIcon.classList.remove('hidden');

            sidebarImg.classList.add('hidden');
            sidebarIcon.classList.remove('hidden');

            removeBtn.classList.add('hidden');
        }
    }

    // ==========================================
    // TAB NAVIGATION
    // ==========================================
    function setupTabs() {
        const tabs = document.querySelectorAll('.profile-tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = 'tab-' + tab.dataset.tab;

                // Update active states
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show/hide content with animation
                contents.forEach(c => {
                    if (c.id === targetId) {
                        c.classList.remove('hidden');
                        c.style.opacity = '0';
                        c.style.transform = 'translateY(10px)';
                        requestAnimationFrame(() => {
                            c.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                            c.style.opacity = '1';
                            c.style.transform = 'translateY(0)';
                        });
                    } else {
                        c.classList.add('hidden');
                    }
                });
            });
        });
    }

    // ==========================================
    // AVATAR UPLOAD
    // ==========================================
    function setupAvatarUpload() {
        const input = document.getElementById('avatar-upload');
        const removeBtn = document.getElementById('btn-remove-avatar');

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validation
            if (!file.type.startsWith('image/')) {
                showToast('Selecione um arquivo de imagem válido', 'warning');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showToast('Imagem muito grande. Máximo: 5MB', 'warning');
                return;
            }

            try {
                showToast('Enviando foto...', 'info');

                const avatarUrl = await EcoBackend.uploadAvatar(file);
                renderAvatar(avatarUrl);

                showToast('Foto atualizada com sucesso!', 'success');

                // Animate the avatar
                const container = document.getElementById('avatar-container');
                container.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    container.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    container.style.transform = 'scale(1)';
                }, 100);

            } catch (err) {
                showToast('Erro ao enviar foto: ' + err.message, 'error');
            }

            input.value = '';
        });

        removeBtn.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Remover foto?',
                text: 'Sua foto de perfil será removida.',
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
                try {
                    await EcoBackend.updatePerfil({ avatar_url: null });
                    renderAvatar(null);
                    showToast('Foto removida', 'success');
                } catch (err) {
                    showToast('Erro ao remover foto', 'error');
                }
            }
        });
    }

    // ==========================================
    // BIO CHARACTER COUNTER
    // ==========================================
    function setupBioCounter() {
        const bio = document.getElementById('input-bio');
        const counter = document.getElementById('bio-chars');

        bio.addEventListener('input', updateBioCounter);
    }

    function updateBioCounter() {
        const bio = document.getElementById('input-bio');
        const counter = document.getElementById('bio-chars');
        const len = bio.value.length;
        counter.textContent = len;

        if (len > 250) {
            counter.style.color = '#fbbf24';
        } else if (len > 300) {
            counter.style.color = '#f87171';
        } else {
            counter.style.color = '';
        }
    }

    // ==========================================
    // PASSWORD STRENGTH METER
    // ==========================================
    function setupPasswordStrength() {
        const input = document.getElementById('input-nova-senha');
        const bar = document.getElementById('password-strength-bar');
        const text = document.getElementById('password-strength-text');

        if (!input) return;

        input.addEventListener('input', () => {
            const pwd = input.value;
            const result = calcPasswordStrength(pwd);

            bar.style.width = result.percent + '%';
            bar.style.background = result.color;
            text.textContent = result.label;
            text.style.color = result.color;
        });
    }

    function calcPasswordStrength(pwd) {
        if (!pwd || pwd.length === 0) return { percent: 0, color: '#64748b', label: 'Força da senha' };

        let score = 0;
        if (pwd.length >= 6) score += 15;
        if (pwd.length >= 8) score += 15;
        if (pwd.length >= 12) score += 10;
        if (/[a-z]/.test(pwd)) score += 10;
        if (/[A-Z]/.test(pwd)) score += 15;
        if (/[0-9]/.test(pwd)) score += 15;
        if (/[^A-Za-z0-9]/.test(pwd)) score += 20;

        if (score <= 25) return { percent: 20, color: '#f87171', label: 'Muito fraca' };
        if (score <= 40) return { percent: 40, color: '#fb923c', label: 'Fraca' };
        if (score <= 60) return { percent: 60, color: '#fbbf24', label: 'Razoável' };
        if (score <= 80) return { percent: 80, color: '#4ade80', label: 'Boa' };
        return { percent: 100, color: '#22c55e', label: 'Excelente' };
    }

    // ==========================================
    // SAVE BUTTONS (Personal Data + Preferences)
    // ==========================================
    function setupSaveButtons(originalPerfil) {
        // Save Personal Data
        document.getElementById('btn-save-dados').addEventListener('click', async () => {
            const campos = {
                nome_completo: document.getElementById('input-nome').value.trim(),
                telefone: document.getElementById('input-telefone').value.trim(),
                cargo: document.getElementById('input-cargo').value.trim(),
                departamento: document.getElementById('input-departamento').value,
                empresa: document.getElementById('input-empresa').value.trim(),
                bio: document.getElementById('input-bio').value.trim(),
            };

            if (!campos.nome_completo) {
                showToast('O nome é obrigatório', 'warning');
                return;
            }

            try {
                const btn = document.getElementById('btn-save-dados');
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Salvando...';
                btn.disabled = true;

                const updated = await EcoBackend.updatePerfil(campos);

                // Update header display
                document.getElementById('profile-display-name').textContent = campos.nome_completo;
                document.getElementById('profile-badge-cargo').textContent = campos.cargo || 'Cargo';
                document.getElementById('profile-badge-dept').textContent = campos.departamento;
                document.getElementById('sidebar-user-name').textContent = campos.nome_completo;

                showToast('Dados salvos com sucesso!', 'success');

                btn.innerHTML = '<span class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">check_circle</span> Salvo!</span>';
                setTimeout(() => {
                    btn.innerHTML = '<span class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">save</span> Salvar Alterações</span>';
                    btn.disabled = false;
                }, 2000);

            } catch (err) {
                showToast('Erro ao salvar: ' + err.message, 'error');
                const btn = document.getElementById('btn-save-dados');
                btn.innerHTML = '<span class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">save</span> Salvar Alterações</span>';
                btn.disabled = false;
            }
        });

        // Reset Personal Data
        document.getElementById('btn-reset-dados').addEventListener('click', () => {
            document.getElementById('input-nome').value = originalPerfil.nome_completo || '';
            document.getElementById('input-telefone').value = originalPerfil.telefone || '';
            document.getElementById('input-cargo').value = originalPerfil.cargo || '';
            document.getElementById('input-empresa').value = originalPerfil.empresa || '';
            document.getElementById('input-bio').value = originalPerfil.bio || '';
            updateBioCounter();
            showToast('Alterações descartadas', 'info');
        });

        // Save Preferences
        document.getElementById('btn-save-prefs').addEventListener('click', async () => {
            const prefs = {
                notificacoes_email: document.getElementById('pref-email').checked,
                notificacoes_push: document.getElementById('pref-push').checked,
                notificacoes_licenca: document.getElementById('pref-licenca').checked,
                notificacoes_financeiro: document.getElementById('pref-financeiro').checked,
                idioma: document.getElementById('input-idioma').value,
            };

            try {
                await EcoBackend.updatePerfil(prefs);
                showToast('Preferências salvas!', 'success');
            } catch (err) {
                showToast('Erro ao salvar preferências', 'error');
            }
        });

        // Change Password
        document.getElementById('btn-change-password').addEventListener('click', async () => {
            const atual = document.getElementById('input-senha-atual').value;
            const nova = document.getElementById('input-nova-senha').value;
            const confirmar = document.getElementById('input-confirmar-senha').value;

            if (!atual) {
                showToast('Digite sua senha atual', 'warning');
                return;
            }
            if (!nova || nova.length < 8) {
                showToast('A nova senha deve ter ao menos 8 caracteres', 'warning');
                return;
            }
            if (nova !== confirmar) {
                showToast('As senhas não coincidem', 'warning');
                return;
            }

            try {
                if (EcoBackend.IS_MOCK) {
                    showToast('Senha alterada com sucesso! (modo demo)', 'success');
                } else {
                    const { error } = await EcoBackend.supabase.auth.updateUser({ password: nova });
                    if (error) throw error;
                    showToast('Senha alterada com sucesso!', 'success');
                }

                document.getElementById('input-senha-atual').value = '';
                document.getElementById('input-nova-senha').value = '';
                document.getElementById('input-confirmar-senha').value = '';
                document.getElementById('password-strength-bar').style.width = '0%';
                document.getElementById('password-strength-text').textContent = 'Força da senha';

            } catch (err) {
                showToast('Erro ao alterar senha: ' + err.message, 'error');
            }
        });

        // Delete Account
        document.getElementById('btn-delete-account').addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Excluir conta permanentemente?',
                html: 'Esta ação é <strong>irreversível</strong>. Todos os seus dados serão apagados.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#f87171',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sim, excluir tudo',
                cancelButtonText: 'Cancelar',
                background: '#0f1712',
                color: '#e2e8f0',
            });

            if (result.isConfirmed) {
                if (EcoBackend.IS_MOCK) {
                    showToast('Conta excluída (modo demo)', 'info');
                    EcoBackend.logout();
                } else {
                    showToast('Função disponível apenas pelo suporte. Contate o administrador.', 'info');
                }
            }
        });

        // 2FA Toggle
        document.getElementById('pref-2fa').addEventListener('change', async (e) => {
            if (e.target.checked) {
                showToast('Autenticação 2FA ativada (modo demo)', 'success');
            } else {
                showToast('Autenticação 2FA desativada', 'info');
            }
            await EcoBackend.updatePerfil({ two_factor: e.target.checked });
        });
    }

    // ==========================================
    // ATIVIDADES
    // ==========================================
    async function loadActivities() {
        const container = document.getElementById('profile-activity-timeline');
        if (!container) return;

        try {
            const atividades = await EcoQueries.atividades.listar(20);

            container.innerHTML = atividades.map((a, i) => {
                const timeAgo = getTimeAgo(new Date(a.criado_em));
                const typeInfo = getActivityInfo(a.tipo);

                return `
                    <div class="timeline-item ${typeInfo.cssClass} fade-in" style="animation-delay: ${i * 0.05}s;">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <span class="p-1.5 rounded-lg ${typeInfo.bgClass}">
                                    <span class="material-symbols-outlined text-[14px] ${typeInfo.textClass}">${typeInfo.icon}</span>
                                </span>
                                <div>
                                    <p class="text-sm font-medium text-slate-200">${a.descricao}</p>
                                    <p class="text-[10px] text-slate-500 mt-0.5">${timeAgo}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            container.innerHTML = '<p class="text-center text-slate-500 text-sm py-6">Erro ao carregar atividades</p>';
        }
    }

    function getActivityInfo(tipo) {
        const map = {
            'login': { icon: 'login', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', cssClass: '' },
            'criacao': { icon: 'add_circle', bgClass: 'bg-blue-500/15', textClass: 'text-blue-400', cssClass: 'info' },
            'edicao': { icon: 'edit_note', bgClass: 'bg-yellow-500/15', textClass: 'text-yellow-400', cssClass: 'warning' },
            'exclusao': { icon: 'delete', bgClass: 'bg-red-500/15', textClass: 'text-red-400', cssClass: 'danger' },
            'upload': { icon: 'cloud_upload', bgClass: 'bg-purple-500/15', textClass: 'text-purple-400', cssClass: 'info' },
        };
        return map[tipo] || { icon: 'info', bgClass: 'bg-slate-500/15', textClass: 'text-slate-400', cssClass: '' };
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
    // HELPERS
    // ==========================================
    function setToggle(id, value) {
        const el = document.getElementById(id);
        if (el) el.checked = !!value;
    }

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
