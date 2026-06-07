import { createClient } from '@/lib/supabase/client';
import { env, isSupabaseConfigured } from '@/lib/env';

const AUTH_NEXT_COOKIE = 'linkup_auth_next';
const AUTH_NEXT_STORAGE = 'linkup_auth_next';

/** OAuth redirect — must be listed in Supabase Auth → URL Configuration (use wildcard if needed). */
export function getAuthCallbackUrl(): string {
  const base = env.siteUrl.replace(/\/$/, '');
  return `${base}/auth/callback`;
}

function rememberNextPath(nextPath: string) {
  const safe = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/discover';
  try {
    sessionStorage.setItem(AUTH_NEXT_STORAGE, safe);
  } catch {
    /* ignore */
  }
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}; path=/; max-age=600; SameSite=Lax`;
}

/** Read post-login path set before OAuth (cookie survives server callback). */
export function consumeStoredNextPath(): string {
  if (typeof document === 'undefined') return '/discover';
  let next = '/discover';
  try {
    const fromStorage = sessionStorage.getItem(AUTH_NEXT_STORAGE);
    if (fromStorage) next = fromStorage;
    sessionStorage.removeItem(AUTH_NEXT_STORAGE);
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_NEXT_COOKIE}=([^;]*)`));
  if (match?.[1]) {
    try {
      next = decodeURIComponent(match[1]);
    } catch {
      /* ignore */
    }
  }
  document.cookie = `${AUTH_NEXT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  return next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
}

/**
 * Google sign-in via Supabase OAuth (full-page redirect).
 * Client ID/secret live in Supabase Dashboard → Authentication → Google.
 */
export async function signInWithGoogle(nextPath = '/discover'): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and anon key.') };
  }

  if (typeof window === 'undefined') {
    return { error: new Error('Google sign-in must run in the browser.') };
  }

  rememberNextPath(nextPath);

  const supabase = createClient();
  const redirectTo = getAuthCallbackUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) return { error: new Error(error.message) };
  if (!data?.url) return { error: new Error('No OAuth URL returned. Is Google enabled in Supabase?') };

  window.location.assign(data.url);
  return { error: null };
}
