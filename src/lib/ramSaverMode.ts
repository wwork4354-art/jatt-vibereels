import { useCallback, useEffect, useState } from 'react';

const RAM_SAVER_STORAGE_KEY = 'jatt_ram_saver_mode';
const RAM_SAVER_EVENT = 'jatt-ram-saver-changed';

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
}

export function getDeviceMemoryGB(): number | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as NavigatorWithMemory;
  return typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)
    ? nav.deviceMemory
    : null;
}

export function isLowRamDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithMemory;
  const mem = getDeviceMemoryGB();
  if (mem !== null && mem <= 4) {
    return true;
  }
  if (nav.connection?.saveData) {
    return true;
  }
  return false;
}

export function getIsRamSaverMode(): boolean {
  try {
    const saved = localStorage.getItem(RAM_SAVER_STORAGE_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch {
    // ignore storage failures
  }
  return isLowRamDevice();
}

export function applyRamSaverDomClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('ram-saver-mode');
  } else {
    root.classList.remove('ram-saver-mode');
  }
}

export function setRamSaverMode(enabled: boolean): void {
  try {
    localStorage.setItem(RAM_SAVER_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // ignore storage failures
  }
  applyRamSaverDomClass(enabled);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RAM_SAVER_EVENT, { detail: { enabled } }));
  }
}

// Initialize root class immediately on module load so 3GB/4GB devices disable blur on first paint
applyRamSaverDomClass(getIsRamSaverMode());

export function useRamSaverMode() {
  const [isRamSaverMode, setIsRamSaverState] = useState<boolean>(() => getIsRamSaverMode());
  const deviceMemoryGB = getDeviceMemoryGB();
  const autoLowRam = isLowRamDevice();

  useEffect(() => {
    applyRamSaverDomClass(isRamSaverMode);
  }, [isRamSaverMode]);

  useEffect(() => {
    const handleSync = () => {
      setIsRamSaverState(getIsRamSaverMode());
    };
    window.addEventListener(RAM_SAVER_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(RAM_SAVER_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const setRamSaverModeEnabled = useCallback((enabled: boolean) => {
    setRamSaverMode(enabled);
    setIsRamSaverState(enabled);
  }, []);

  const toggleRamSaverMode = useCallback(() => {
    const next = !getIsRamSaverMode();
    setRamSaverMode(next);
    setIsRamSaverState(next);
    return next;
  }, []);

  return {
    isRamSaverMode,
    setRamSaverModeEnabled,
    toggleRamSaverMode,
    deviceMemoryGB,
    autoLowRam,
  };
}
