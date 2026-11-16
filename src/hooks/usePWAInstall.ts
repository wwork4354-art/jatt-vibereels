import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Capture beforeinstallprompt early at module load so events fired before React mounts are preserved
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMatch = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const isIosStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return Boolean(isStandaloneMatch || isIosStandalone);
  });
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const iosDevice =
      /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIos(iosDevice);

    const syncGlobalPrompt = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    promptListeners.add(syncGlobalPrompt);

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    const mq = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
      }
    };
    mq?.addEventListener?.('change', handleDisplayChange);

    return () => {
      promptListeners.delete(syncGlobalPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mq?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<
    'accepted' | 'dismissed' | 'ios' | 'manual'
  > => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      return choice.outcome;
    }
    if (isIos && !isInstalled) {
      return 'ios';
    }
    return 'manual';
  }, [deferredPrompt, isIos, isInstalled]);

  return {
    isInstallable: !isInstalled,
    hasNativePrompt: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIos,
    promptInstall,
  };
}
