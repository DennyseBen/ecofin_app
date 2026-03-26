import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // We no longer need the prompt. Clear it up.
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl shadow-green-500/10 border border-green-500/20 p-4 z-50 flex items-start gap-4 animate-in slide-in-from-bottom-5">
      <div className="bg-green-100 dark:bg-green-500/20 p-3 rounded-xl flex-shrink-0">
        <Download className="text-green-600 dark:text-green-400" size={24} />
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Instale o App EcoFin</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Adicione o EcoFin à sua tela inicial para acesso rápido, melhor desempenho e uma experiência em tela cheia!
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Instalar Agora
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
      <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
        <X size={16} />
      </button>
    </div>
  );
}
