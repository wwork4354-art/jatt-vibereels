import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMatch = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return Boolean(isStandaloneMatch || isIosStandalone);
  });
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIos(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mq = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    mq?.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mq?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      return choice.outcome;
    }
    if (isIos && !isInstalled) {
      return 'ios';
    }
    return 'unavailable';
  }, [deferredPrompt, isIos, isInstalled]);

  return {
    isInstallable: !isInstalled && (Boolean(deferredPrompt) || isIos),
    hasNativePrompt: Boolean(deferredPrompt),
    isInstalled,
    isIos,
    promptInstall,
  };
}
