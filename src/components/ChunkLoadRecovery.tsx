'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'linkup-chunk-reload';

/**
 * After HMR or a dev-server restart, the browser may request stale JS chunks and throw
 * ChunkLoadError. One automatic reload usually fixes it.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY);
    }, 10_000);

    function onError(event: ErrorEvent) {
      const message = event.message ?? '';
      const isChunkFailure =
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module');

      if (!isChunkFailure) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;

      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }

    window.addEventListener('error', onError);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
