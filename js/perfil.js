// =============================================
// perfil.js — Perfil do Usuário
// Refatorado: sem Tailwind, compatível com novo tema
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await EcoBackend.checkSession();
    if (!session) { window.location.href = 'index.html'; return; }
    renderUserInfo(session);

    const perfil = await EcoBackend.getPerfil();
    renderProfile(perfil, session);
    setupSaveButton(perfil);
    setupAvatarUpload();
});

function renderProfile(perfil, session) {
    const nome = perfil?.nome || session?.user?.email?.split('@')[0] || 'Usuário';
    const email = perfil?.email || session?.user?.email || '';
    const initial = nome.charAt(0).toUpperCase();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };

    setText('perfil-nome-display', nome);
    setText('perfil-cargo-display', perfil?.cargo || 'Consultor Ambiental');
    setText('perfil-email-display', email);
    const avatarLg = document.getElementById('perfil-avatar-lg');
    if (avatarLg) avatarLg.textContent = initial;

    set('perfil-nome', nome);
    set('perfil-email', email);
    set('perfil-telefone', perfil?.telefone);
    set('perfil-cargo', perfil?.cargo);
    set('perfil-departamento', perfil?.departamento);
    set('perfil-empresa', perfil?.empresa);
    set('perfil-bio', perfil?.bio);
}

function setupSaveButton() {
    document.getElementById('btn-salvar-perfil')?.addEventListener('click', async () => {
        const data = {
            nome: document.getElementById('perfil-nome')?.value,
            telefone: document.getElementById('perfil-telefone')?.value,
            cargo: document.getElementById('perfil-cargo')?.value,
            departamento: document.getElementById('perfil-departamento')?.value,
            empresa: document.getElementById('perfil-empresa')?.value,
            bio: document.getElementById('perfil-bio')?.value,
        };

        try {
            await EcoBackend.updatePerfil(data);
            // Update display
            const n = data.nome || 'Usuário';
            document.getElementById('perfil-nome-display').textContent = n;
            document.getElementById('perfil-cargo-display').textContent = data.cargo || '—';
            document.getElementById('perfil-avatar-lg').textContent = n.charAt(0).toUpperCase();
            document.getElementById('sidebar-user-name').textContent = n;
            showToast('Perfil atualizado com sucesso!', 'success');
        } catch (e) {
            showToast('Erro ao salvar perfil', 'error');
        }
    });
}

function setupAvatarUpload() {
    const btn = document.getElementById('btn-upload-avatar');
    const input = document.getElementById('avatar-input');
    if (!btn || !input) return;
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = e => {
                const avatarEl = document.getElementById('perfil-avatar-lg');
                if (avatarEl) {
                    avatarEl.style.backgroundImage = `url(${e.target.result})`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.style.backgroundPosition = 'center';
                    avatarEl.textContent = '';
                }
            };
            reader.readAsDataURL(file);
            showToast('Foto atualizada!', 'success');
        }
    });
}
