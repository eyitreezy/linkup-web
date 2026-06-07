'use client';

import { useSyncExternalStore } from 'react';

function subscribeMedia(query: string, onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeMedia(query, onChange),
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Below `lg` — matches sidebar / mobile shell layout. */
export function useIsMobileDiscoverLayout() {
  return useMediaQuery('(max-width: 1023px)');
}

/** Alias — same breakpoint as discover / bottom nav shell. */
export function useIsMobileShellLayout() {
  return useIsMobileDiscoverLayout();
}
