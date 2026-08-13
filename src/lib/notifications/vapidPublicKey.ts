const BUILD_TIME_VAPID_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();

let runtimeVapidKeyCache: string | null = BUILD_TIME_VAPID_KEY || null;
let runtimeVapidKeyPromise: Promise<string> | null = null;

/** Resolve VAPID public key — build-time env first, then runtime API fallback. */
export async function resolveVapidPublicKey(): Promise<string> {
  if (runtimeVapidKeyCache) return runtimeVapidKeyCache;
  if (typeof window === 'undefined') return BUILD_TIME_VAPID_KEY;

  if (!runtimeVapidKeyPromise) {
    runtimeVapidKeyPromise = fetch('/api/push/vapid-public-key', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return '';
        const data = (await res.json()) as { publicKey?: string | null };
        return data.publicKey?.trim() ?? '';
      })
      .catch(() => '')
      .then((key) => {
        runtimeVapidKeyCache = key || null;
        return key;
      });
  }

  return runtimeVapidKeyPromise;
}

export function getCachedVapidPublicKey(): string {
  return runtimeVapidKeyCache ?? BUILD_TIME_VAPID_KEY;
}

export function isVapidPublicKeyConfigured(): boolean {
  return !!getCachedVapidPublicKey();
}
