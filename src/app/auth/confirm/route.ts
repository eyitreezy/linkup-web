import { formatAuthCallbackError, isPkceVerifierError } from '@/lib/auth/authCallbackErrors';
import {
  resolvePostAuthDestinationForUserId,
  safeAuthNextPath,
} from '@/lib/auth/resolvePostAuthDestination';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { isSupabaseConfigured } from '@/lib/env';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function loginErrorRedirect(origin: string, message: string) {
  const url = new URL('/login', origin);
  if (isPkceVerifierError(message)) {
    url.searchParams.set('error', 'email_confirmed');
  } else {
    url.searchParams.set('error', 'auth_callback');
    url.searchParams.set('error_description', formatAuthCallbackError(message).slice(0, 200));
  }
  return NextResponse.redirect(url.toString());
}

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
}

/** Email confirmation — token_hash (recommended) or PKCE code fallback. */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeAuthNextPath(searchParams.get('next'));

  if (!isSupabaseConfigured) {
    return loginErrorRedirect(origin, 'Supabase is not configured on the web app.');
  }

  const cookieResponse = NextResponse.next({ request });
  const supabase = createRouteHandlerClient(request, cookieResponse);

  let authError: string | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    authError = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
  } else {
    return loginErrorRedirect(origin, 'Invalid confirmation link. Request a new one from the sign-up screen.');
  }

  if (authError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/confirm]', authError);
    }
    return loginErrorRedirect(origin, authError);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destination = user
    ? await resolvePostAuthDestinationForUserId(supabase, user.id, next)
    : next;

  const redirectResponse = NextResponse.redirect(new URL(destination, origin));
  copySessionCookies(cookieResponse, redirectResponse);
  return redirectResponse;
}
