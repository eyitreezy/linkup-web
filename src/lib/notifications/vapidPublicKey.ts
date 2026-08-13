const BUILD_TIME_VAPID_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();

let runtimeVapidKeyCache: string | null = BUILD_TIME_VAPID_KEY || null;
let runtimeVapidKeyPromise: Promise<string> | null = null;

async function fetchVapidKeyFromApi(): Promise<string> {
  const paths = ['/api/vapid-public-key', '/api/push/vapid-public-key'];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = (await res.json()) as { publicKey?: string | null };
      const key = data.publicKey?.trim() ?? '';
      if (key) return key;
    } catch {
      /* try next path */
    }
  }
  return '';
}

/** Resolve VAPID public key — build-time env first, then runtime API fallback. */
export async function resolveVapidPublicKey(): Promise<string> {
  if (runtimeVapidKeyCache) return runtimeVapidKeyCache;
  if (typeof window === 'undefined') return BUILD_TIME_VAPID_KEY;

  if (!runtimeVapidKeyPromise) {
    runtimeVapidKeyPromise = fetchVapidKeyFromApi().then((key) => {
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
