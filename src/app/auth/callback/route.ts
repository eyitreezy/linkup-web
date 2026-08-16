import { formatAuthCallbackError, isPkceVerifierError } from '@/lib/auth/authCallbackErrors';
import { formatRecoveryAuthError } from '@/lib/auth/recoveryErrors';
import {
  resolvePostAuthDestinationForUserId,
  safeAuthNextPath,
} from '@/lib/auth/resolvePostAuthDestination';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { isSupabaseConfigured } from '@/lib/env';
import {
  hasPendingSignupPrivacyConsentCookie,
  PENDING_SIGNUP_PRIVACY_CONSENT_COOKIE,
} from '@/lib/privacy/pendingSignupConsentStorage';
import { recordPrivacyConsentServer } from '@/lib/privacy/recordPrivacyConsentServer';
import { NextRequest, NextResponse } from 'next/server';

function safeNextPath(raw: string | null): string {
  return safeAuthNextPath(raw);
}

function loginErrorRedirect(origin: string, message: string, next?: string) {
  if (next === '/reset-password') {
    const url = new URL('/reset-password', origin);
    url.searchParams.set('error', 'recovery_failed');
    url.searchParams.set('error_description', formatRecoveryAuthError(message).slice(0, 200));
    return NextResponse.redirect(url.toString());
  }

  const url = new URL('/login', origin);
  if (isPkceVerifierError(message)) {
    url.searchParams.set('error', 'email_confirmed');
  } else {
    url.searchParams.set('error', 'auth_callback');
    url.searchParams.set('error_description', formatAuthCallbackError(message).slice(0, 200));
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const nextCookie = request.cookies.get('linkup_auth_next')?.value;
  let nextFromCookie: string | null = null;
  if (nextCookie) {
    try {
      nextFromCookie = decodeURIComponent(nextCookie);
    } catch {
      nextFromCookie = nextCookie;
    }
  }
  const next = safeNextPath(searchParams.get('next') ?? nextFromCookie);

  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');
  if (oauthError) {
    const msg = oauthErrorDesc ?? oauthError;
    return loginErrorRedirect(origin, msg, next);
  }

  if (!isSupabaseConfigured) {
    return loginErrorRedirect(origin, 'Supabase is not configured on the web app.', next);
  }

  if (!code) {
    return loginErrorRedirect(origin, 'No authorization code returned from Google.', next);
  }

  const cookieResponse = NextResponse.next({ request });
  const supabase = createRouteHandlerClient(request, cookieResponse);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/callback] exchangeCodeForSession:', error.message);
    }
    return loginErrorRedirect(origin, error.message, next);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pendingSignupConsent = hasPendingSignupPrivacyConsentCookie(request.headers.get('cookie'));
  if (pendingSignupConsent && user) {
    await recordPrivacyConsentServer(supabase, user.id, 'signup');
    cookieResponse.cookies.set(PENDING_SIGNUP_PRIVACY_CONSENT_COOKIE, '', { path: '/', maxAge: 0 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user && next === '/reset-password') {
    const redirectResponse = NextResponse.redirect(new URL('/reset-password', origin));
    cookieResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    redirectResponse.cookies.set('linkup_auth_next', '', { path: '/', maxAge: 0 });
    return redirectResponse;
  }

  let destination = next;
  if (user) {
    const { error: syncErr } = await supabase.rpc('sync_pending_plan_invitations_for_user', {
      p_token: null,
    });
    if (syncErr && process.env.NODE_ENV === 'development') {
      console.warn('[auth/callback] sync_pending_plan_invitations_for_user:', syncErr.message);
    }
    destination = await resolvePostAuthDestinationForUserId(supabase, user.id, next);
  }

  const redirectResponse = NextResponse.redirect(new URL(destination, origin));
  cookieResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  redirectResponse.cookies.set('linkup_auth_next', '', { path: '/', maxAge: 0 });

  return redirectResponse;
}
