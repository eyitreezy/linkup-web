import { formatRecoveryAuthError } from '@/lib/auth/recoveryErrors';
import { createClient } from '@/lib/supabase/client';

/** Parse recovery credentials from the current URL (query or hash). */
export function parseRecoveryCredentialsFromUrl(url: string): {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);

  return {
    tokenHash: parsed.searchParams.get('token_hash'),
    type: parsed.searchParams.get('type') ?? hash.get('type'),
    code: parsed.searchParams.get('code'),
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
  };
}

/**
 * Establish a password-recovery session from link credentials.
 * Supports token_hash (cross-browser), hash tokens (cross-browser), and PKCE code (same browser).
 */
export async function establishRecoverySessionFromUrl(
  url: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const { tokenHash, type, code, accessToken, refreshToken } = parseRecoveryCredentialsFromUrl(url);

  if (tokenHash && type === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (error) return { ok: false, message: formatRecoveryAuthError(error.message) };
    return { ok: true };
  }

  if (accessToken && refreshToken && type === 'recovery') {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { ok: false, message: formatRecoveryAuthError(error.message) };
    return { ok: true };
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: formatRecoveryAuthError(error.message) };
    return { ok: true };
  }

  return { ok: false, message: 'Invalid reset link. Request a new one from the sign-in screen.' };
}

export function stripRecoveryCredentialsFromUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
}
