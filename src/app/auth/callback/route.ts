import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { env, isSupabaseConfigured } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/discover';
  return raw;
}

function loginErrorRedirect(origin: string, message: string) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', 'auth_callback');
  url.searchParams.set('error_description', message.slice(0, 200));
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
    return loginErrorRedirect(origin, decodeURIComponent(msg.replace(/\+/g, ' ')));
  }

  if (!isSupabaseConfigured) {
    return loginErrorRedirect(origin, 'Supabase is not configured on the web app.');
  }

  if (!code) {
    return loginErrorRedirect(origin, 'No authorization code returned from Google.');
  }

  const redirectUrl = new URL(next, origin).toString();
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('linkup_auth_next', '', { path: '/', maxAge: 0 });

  const supabase = createRouteHandlerClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/callback] exchangeCodeForSession:', error.message);
    }
    return loginErrorRedirect(origin, error.message);
  }

  return response;
}
