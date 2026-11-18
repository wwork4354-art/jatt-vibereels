import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { checkFrameSafety, installDevToolsProtection } from './utils/security';

installDevToolsProtection();
const frameSafety = checkFrameSafety();

if (frameSafety.blocked) {
  createRoot(document.getElementById('root')!).render(
    <div className="min-h-screen w-full bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-rose-500/40 bg-neutral-900 p-6 text-center space-y-3 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-widest text-rose-400">
          Security Shield Active
        </p>
        <h1 className="text-lg font-black text-white">
          Clickjacking Protection Triggered
        </h1>
        <p className="text-xs text-neutral-300 leading-relaxed">
          Embedding Jatt VibeReels inside an untrusted external frame is blocked to
          protect creator accounts and media. Please open the app directly in its own tab.
        </p>
      </div>
    </div>
  );
} else {
  registerSW({ immediate: true });
  createRoot(document.getElementById('root')!).render(<App />);
}

