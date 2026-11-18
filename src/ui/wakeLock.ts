import { useEffect, useState } from 'react';

export type WakeState = 'off' | 'on' | 'unsupported' | 'denied';

/**
 * Keep the screen awake while `active`. Browsers release the lock whenever the page is
 * hidden, so it is re-requested each time the page becomes visible again (per MDN).
 * Needs a secure context (HTTPS or localhost).
 */
export function useWakeLock(active: boolean): WakeState {
  const [state, setState] = useState<WakeState>('off');
  useEffect(() => {
    if (!active) { setState('off'); return; }
    if (!('wakeLock' in navigator) || !window.isSecureContext) { setState('unsupported'); return; }
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (stopped) { void sentinel.release(); return; }
        setState('on');
        sentinel.addEventListener('release', () => { if (!stopped) setState('off'); });
      } catch {
        if (!stopped) setState('denied');
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
  return state;
}
