/** Detect Web Push support without checking `PushManager` on `window` (not a global in Chrome). */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('Notification' in window)) return false;
  try {
    return 'pushManager' in ServiceWorkerRegistration.prototype;
  } catch {
    return false;
  }
}

export function isSecureWebPushContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext;
}
