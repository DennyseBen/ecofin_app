/**
 * PWA Install — suporte a Android/Windows (beforeinstallprompt) e iOS (banner manual)
 */
(function () {
  // Registra service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isInStandaloneMode) return; // já instalado

  // ── iOS: banner com instrução manual ─────────────────────────────────────
  if (isIOS) {
    const dismissed = sessionStorage.getItem('ios-install-dismissed');
    if (dismissed) return;

    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:0;left:0;right:0;z-index:9999;
        background:#0f172a;color:#fff;
        padding:16px 20px 20px;
        border-top:1px solid #1e293b;
        font-family:system-ui,-apple-system,sans-serif;
        box-shadow:0 -4px 20px rgba(0,0,0,0.4);
      ">
        <button id="ios-banner-close" style="
          position:absolute;top:10px;right:14px;
          background:none;border:none;color:#94a3b8;
          font-size:20px;cursor:pointer;line-height:1;
        ">✕</button>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="
            width:42px;height:42px;border-radius:10px;
            background:#16a34a;display:flex;align-items:center;
            justify-content:center;font-size:22px;font-weight:800;color:#fff;
            flex-shrink:0;
          ">E</div>
          <div>
            <div style="font-weight:700;font-size:15px">Instalar EcoFin Manager</div>
            <div style="font-size:12px;color:#94a3b8">Acesso rápido pela tela inicial</div>
          </div>
        </div>
        <div style="
          background:#1e293b;border-radius:10px;padding:12px 14px;
          font-size:13px;color:#cbd5e1;line-height:1.6;
        ">
          1. Toque em
          <span style="
            display:inline-flex;align-items:center;gap:3px;
            background:#334155;border-radius:5px;padding:1px 6px;
            font-size:13px;vertical-align:middle;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
            </svg>
            Compartilhar
          </span>
          na barra do Safari<br>
          2. Role e toque em <strong style="color:#fff">"Adicionar à Tela de Início"</strong>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    document.getElementById('ios-banner-close').addEventListener('click', () => {
      banner.remove();
      sessionStorage.setItem('ios-install-dismissed', '1');
    });
    return;
  }

  // ── Android / Windows / Chrome: beforeinstallprompt ──────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:0;left:0;right:0;z-index:9999;
        background:#0f172a;color:#fff;
        padding:14px 20px 18px;
        border-top:1px solid #1e293b;
        font-family:system-ui,-apple-system,sans-serif;
        box-shadow:0 -4px 20px rgba(0,0,0,0.4);
        display:flex;align-items:center;gap:14px;
      ">
        <div style="
          width:42px;height:42px;border-radius:10px;
          background:#16a34a;display:flex;align-items:center;
          justify-content:center;font-size:22px;font-weight:800;color:#fff;
          flex-shrink:0;
        ">E</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">Instalar EcoFin Manager</div>
          <div style="font-size:12px;color:#94a3b8">Acesso rápido, funciona offline</div>
        </div>
        <button id="pwa-install-btn" style="
          background:#16a34a;color:#fff;border:none;
          padding:8px 16px;border-radius:8px;
          font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;
        ">Instalar</button>
        <button id="pwa-install-close" style="
          background:none;border:none;color:#94a3b8;
          font-size:20px;cursor:pointer;padding:4px;line-height:1;
        ">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { banner.remove(); deferredPrompt = null; });
    });
    document.getElementById('pwa-install-close').addEventListener('click', () => {
      banner.remove();
    });
  });

  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
    deferredPrompt = null;
  });
})();
