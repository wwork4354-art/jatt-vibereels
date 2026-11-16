// Fullscreen & Screen Orientation Lock Utilities with CSS Rotation Fallback

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface VendorHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

type ScreenOrientationLockValue =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

interface ScreenOrientationLike {
  lock?: (orientation: ScreenOrientationLockValue) => Promise<void>;
  unlock?: () => void;
}

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as VendorDocument;
  return (
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

export async function requestElementFullscreen(targetEl: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (getFullscreenElement()) return true;

  const el = (targetEl || document.documentElement) as VendorHTMLElement;
  if (!el) return false;

  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return Boolean(getFullscreenElement());
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return Boolean(getFullscreenElement());
    }
    if (typeof el.webkitRequestFullScreen === 'function') {
      await el.webkitRequestFullScreen();
      return Boolean(getFullscreenElement());
    }
    if (typeof el.mozRequestFullScreen === 'function') {
      await el.mozRequestFullScreen();
      return Boolean(getFullscreenElement());
    }
    if (typeof el.msRequestFullscreen === 'function') {
      await el.msRequestFullscreen();
      return Boolean(getFullscreenElement());
    }
  } catch {
    return false;
  }
  return false;
}

export async function exitDocumentFullscreen(): Promise<void> {
  if (typeof document === 'undefined' || !getFullscreenElement()) return;
  const doc = document as VendorDocument;

  try {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    } else if (typeof doc.mozCancelFullScreen === 'function') {
      await doc.mozCancelFullScreen();
    } else if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen();
    }
  } catch {
    // ignore fullscreen exit errors
  }
}

export async function lockScreenLandscape(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const orient = window.screen?.orientation as unknown as ScreenOrientationLike | undefined;
  if (!orient || typeof orient.lock !== 'function') return false;

  try {
    await orient.lock('landscape');
    return true;
  } catch {
    try {
      await orient.lock('landscape-primary');
      return true;
    } catch {
      return false;
    }
  }
}

export async function unlockOrientationToPortrait(): Promise<void> {
  if (typeof window === 'undefined') return;
  const orient = window.screen?.orientation as unknown as ScreenOrientationLike | undefined;

  // If browser requires active fullscreen to momentarily snap orientation back to portrait,
  // attempt portrait lock before exiting fullscreen, then unlock so natural rotation works.
  if (orient && typeof orient.lock === 'function' && getFullscreenElement()) {
    try {
      await orient.lock('portrait');
    } catch {
      try {
        await orient.lock('portrait-primary');
      } catch {
        // ignore if unsupported or blocked
      }
    }
  }

  await exitDocumentFullscreen();

  if (orient && typeof orient.unlock === 'function') {
    try {
      orient.unlock();
    } catch {
      // ignore if unsupported
    }
  }
}

export function addFullscreenChangeListener(handler: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const events = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange',
  ];
  for (const evt of events) {
    document.addEventListener(evt, handler);
  }
  return () => {
    for (const evt of events) {
      document.removeEventListener(evt, handler);
    }
  };
}
