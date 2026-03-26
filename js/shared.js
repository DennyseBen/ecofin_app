// =============================================
// shared.js — Funções compartilhadas
// Theme toggle, sidebar mobile, user info, toast
// =============================================

// Theme Management
const ThemeManager = {
    init() {
        const saved = localStorage.getItem('ecofin_theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        this.updateIcon(saved);
    },
    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ecofin_theme', next);
        this.updateIcon(next);
    },
    updateIcon(theme) {
        const el = document.getElementById('theme-icon');
        if (el) el.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
};

// Mobile Sidebar
function setupMobileSidebar() {
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!hamburger || !sidebar) return;
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('active');
    });
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

// User Info in Sidebar
function renderUserInfo(session) {
    const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuário';
    const email = session?.user?.email || '';
    const el = (id) => document.getElementById(id);
    if (el('sidebar-user-name')) el('sidebar-user-name').textContent = name;
    if (el('sidebar-user-email')) el('sidebar-user-email').textContent = email;
    if (el('sidebar-avatar')) el('sidebar-avatar').textContent = name.charAt(0).toUpperCase();
}

// Logout
function setupLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await EcoBackend.logout();
    });
}

// Toast
function showToast(msg, type = 'info') {
    if (typeof Swal !== 'undefined') {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        Swal.fire({
            toast: true, position: 'top-end',
            icon: type, title: msg,
            showConfirmButton: false, timer: 3000, timerProgressBar: true,
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            customClass: { popup: 'swal-toast' },
        });
    }
}

// Format helpers
function formatCurrency(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('pt-BR');
}

// Init shared components
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    document.getElementById('theme-toggle')?.addEventListener('click', () => ThemeManager.toggle());
    setupMobileSidebar();
    setupLogout();
});
