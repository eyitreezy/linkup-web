import { formatRecoveryAuthError } from '@/lib/auth/recoveryErrors';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { isSupabaseConfigured } from '@/lib/env';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function resetErrorRedirect(origin: string, message: string) {
  const url = new URL('/reset-password', origin);
  url.searchParams.set('error', 'recovery_failed');
  url.searchParams.set('error_description', formatRecoveryAuthError(message).slice(0, 200));
  return NextResponse.redirect(url.toString());
}

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
}

/** Password recovery — exchange token/code then land on reset-password with session. */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  if (!isSupabaseConfigured) {
    return resetErrorRedirect(origin, 'Supabase is not configured on the web app.');
  }

  const cookieResponse = NextResponse.next({ request });
  const supabase = createRouteHandlerClient(request, cookieResponse);

  let authError: string | null = null;

  if (tokenHash && type === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    authError = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
  } else {
    return resetErrorRedirect(origin, 'Invalid reset link. Request a new one from the sign-in screen.');
  }

  if (authError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/recovery]', authError);
    }
    return resetErrorRedirect(origin, authError);
  }

  const redirectResponse = NextResponse.redirect(new URL('/reset-password', origin));
  copySessionCookies(cookieResponse, redirectResponse);
  return redirectResponse;
}
