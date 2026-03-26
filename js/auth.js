// =============================================
// auth.js — Lógica completa de Autenticação
// Com validações, animações e feedback visual
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Se já está logado, redireciona para dashboard
    const session = await EcoBackend.checkSession();
    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    // 2. Refs de DOM
    const btnLogin = document.getElementById('btn-login');
    const btnGoogle = document.getElementById('btn-google');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePwd = document.getElementById('toggle-password');

    // 3. Toggle visibilidade da senha com animação
    if (togglePwd && passwordInput) {
        togglePwd.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            const icon = togglePwd.querySelector('.material-symbols-outlined');
            icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            icon.style.transform = 'scale(0.8)';
            setTimeout(() => { icon.style.transform = 'scale(1)'; }, 150);
        });
    }

    // 4. Validação em tempo real do email
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const email = emailInput.value.trim();
            if (email.length > 3) {
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                emailInput.style.borderColor = isValid
                    ? 'rgba(74, 222, 128, 0.4)'
                    : 'rgba(248, 113, 113, 0.4)';
            } else {
                emailInput.style.borderColor = '';
            }
        });

        emailInput.addEventListener('blur', () => {
            emailInput.style.borderColor = '';
        });
    }

    // 5. Validação de senha (força)
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const pwd = passwordInput.value;
            if (pwd.length > 0) {
                const strength = getPasswordStrength(pwd);
                passwordInput.style.borderColor = strength.color;
            } else {
                passwordInput.style.borderColor = '';
            }
        });

        passwordInput.addEventListener('blur', () => {
            passwordInput.style.borderColor = '';
        });
    }

    // 6. Login com Email/Senha
    if (btnLogin) {
        btnLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput?.value?.trim();
            const password = passwordInput?.value?.trim();

            // Validação
            if (!email) {
                showToast('Digite seu e-mail', 'warning');
                shakeElement(emailInput);
                emailInput?.focus();
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('E-mail inválido', 'warning');
                shakeElement(emailInput);
                emailInput?.focus();
                return;
            }

            if (!password) {
                showToast('Digite sua senha', 'warning');
                shakeElement(passwordInput);
                passwordInput?.focus();
                return;
            }

            if (password.length < 4) {
                showToast('Senha muito curta', 'warning');
                shakeElement(passwordInput);
                return;
            }

            // Loading state
            const originalHTML = btnLogin.innerHTML;
            btnLogin.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Autenticando...';
            btnLogin.disabled = true;
            btnLogin.style.opacity = '0.7';

            try {
                const result = await EcoBackend.loginWithEmail(email, password);
                if (result.error) {
                    showToast(result.error, 'error');
                    btnLogin.innerHTML = originalHTML;
                    btnLogin.disabled = false;
                    btnLogin.style.opacity = '1';
                    shakeElement(passwordInput);
                    return;
                }

                // Sucesso - animação de saída
                showToast('Login bem-sucedido! Redirecionando...', 'success');
                btnLogin.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span> Verificado!';
                btnLogin.style.background = '#22c55e';

                // Fade out da página
                document.body.style.transition = 'opacity 0.5s ease';
                document.body.style.opacity = '0';

                await sleep(600);
                window.location.href = 'dashboard.html';
            } catch (err) {
                showToast('Erro inesperado: ' + err.message, 'error');
                btnLogin.innerHTML = originalHTML;
                btnLogin.disabled = false;
                btnLogin.style.opacity = '1';
            }
        });
    }

    // 7. Login com Google OAuth
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalHTML = btnGoogle.innerHTML;
            btnGoogle.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Conectando ao Google...';
            btnGoogle.disabled = true;
            btnGoogle.style.opacity = '0.7';

            try {
                await EcoBackend.loginWithGoogle();
            } catch (err) {
                showToast('Erro ao conectar com Google', 'error');
                btnGoogle.innerHTML = originalHTML;
                btnGoogle.disabled = false;
                btnGoogle.style.opacity = '1';
            }
        });
    }

    // 8. Enter para submit
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnLogin?.click();
        });
    }
    if (emailInput) {
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') passwordInput?.focus();
        });
    }

    // 9. Animação de entrada dos campos
    const formElements = document.querySelectorAll('.form-input, .form-select, .btn-primary, .btn-outline');
    formElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 400 + (index * 100));
    });

    // ---- Helpers ----
    function showToast(msg, type = 'info') {
        if (typeof Swal !== 'undefined') {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: type,
                title: msg,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                background: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#f1f5f9' : '#0f172a',
            });
        }
    }

    function shakeElement(el) {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = 'shake 0.5s ease';
        el.style.borderColor = '#f87171';
        setTimeout(() => { el.style.borderColor = ''; }, 2000);
    }

    function getPasswordStrength(pwd) {
        let score = 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 10) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;

        if (score <= 1) return { strength: 'fraca', color: 'rgba(248, 113, 113, 0.5)' };
        if (score <= 3) return { strength: 'média', color: 'rgba(251, 191, 36, 0.5)' };
        return { strength: 'forte', color: 'rgba(74, 222, 128, 0.5)' };
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Inject shake keyframes
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`;
        document.head.appendChild(style);
    }
});
