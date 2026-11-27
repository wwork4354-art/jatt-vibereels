import { soundEngine } from './soundEngine';

export const APP_BACKGROUNDED_EVENT = 'jatt-app-backgrounded';

let isLifecycleRegistered = false;

/**
 * Immediately pauses and mutes all active HTML5 <video>, <audio>, Web Audio contexts,
 * and YouTube <iframe> players across the DOM so zero sound bleeds when the user
 * locks their mobile screen, switches tabs, or minimizes/closes the app.
 */
export function pauseAndMuteAllActiveMedia(reason: string = 'background'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // 1. Pause & mute every HTML5 <video> and <audio> in the DOM synchronously
  const mediaElements = document.querySelectorAll<HTMLMediaElement>('video, audio');
  mediaElements.forEach((mediaEl) => {
    try {
      mediaEl.muted = true;
      if (!mediaEl.paused) {
        mediaEl.pause();
      }
    } catch {
      // Ignore cross-origin / detached element errors
    }
  });

  // 2. Suspend Web Audio Engine (synthesized music loops + preview tracks)
  try {
    soundEngine.suspendAll();
  } catch {
    // Ignore AudioContext suspension errors
  }

  // 3. Pause & mute all embedded YouTube iframes via YouTube IFrame API postMessage
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
  iframes.forEach((iframe) => {
    const src = (iframe.getAttribute('src') || '').toLowerCase();
    if (
      (src.includes('youtube.com') || src.includes('youtube-nocookie.com')) &&
      iframe.contentWindow
    ) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute', args: [] }),
          '*'
        );
      } catch {
        // Ignore cross-origin frame restrictions
      }
    }
  });

  // 4. Notify React video/studio/player components so UI play/pause icons stay in sync
  try {
    window.dispatchEvent(new CustomEvent(APP_BACKGROUNDED_EVENT, { detail: { reason } }));
  } catch {
    // Ignore event dispatch errors
  }
}

/**
 * Registers global visibility and mobile lifecycle guards (`visibilitychange`,
 * `pagehide`, `blur`, `freeze`, and `beforeunload`). Safe to call multiple times.
 */
export function registerGlobalMediaLifecycleListeners(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }
  if (isLifecycleRegistered) {
    return () => {};
  }
  isLifecycleRegistered = true;

  const handleVisibilityChange = () => {
    if (document.hidden || document.visibilityState === 'hidden') {
      pauseAndMuteAllActiveMedia('visibilitychange');
    }
  };
  const handlePageHide = () => pauseAndMuteAllActiveMedia('pagehide');
  const handleBlur = () => pauseAndMuteAllActiveMedia('blur');
  const handleFreeze = () => pauseAndMuteAllActiveMedia('freeze');
  const handleBeforeUnload = () => pauseAndMuteAllActiveMedia('beforeunload');

  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  document.addEventListener('freeze', handleFreeze as EventListener, { passive: true });
  window.addEventListener('pagehide', handlePageHide, { passive: true });
  window.addEventListener('blur', handleBlur, { passive: true });
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    isLifecycleRegistered = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('freeze', handleFreeze as EventListener);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
