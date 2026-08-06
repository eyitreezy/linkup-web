import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/env';
import { resolvePostAuthDestinationForUserId } from '@/lib/auth/resolvePostAuthDestination';

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPlanPreviewPath(pathname: string) {
  return /^\/plan\/[^/]+\/preview\/?$/.test(pathname);
}

function isPlanCardApiPath(pathname: string) {
  return /^\/api\/plan\/[^/]+\/card\/?$/.test(pathname);
}

function isProtectedAppPath(pathname: string) {
  const prefixes = [
    '/discover',
    '/meetr',
    '/plans',
    '/plan-management',
    '/offers',
    '/messages',
    '/profile',
    '/subscription',
    '/settings',
    '/wallet',
    '/trust',
    '/kyc',
    '/support',
    '/plan',
    '/chat',
    '/escrow',
    '/dispute',
    '/disputes',
    '/notifications',
    '/admin',
    '/onboarding',
    '/user',
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/discover', request.url));
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    const url = request.nextUrl.clone();
    const rest = pathname.slice('/settings'.length) || '';
    url.pathname = `/profile${rest}`;
    return NextResponse.redirect(url);
  }

  if (pathname === '/premium' || pathname.startsWith('/premium/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/premium/, '/subscription');
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/auth/callback') || pathname.startsWith('/auth/confirm') || pathname.startsWith('/auth/recovery')) {
    return NextResponse.next();
  }

  if (isPlanCardApiPath(pathname)) {
    return NextResponse.next();
  }

  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPlanPreviewPath(pathname)) {
    if (user) {
      const segments = pathname.split('/').filter(Boolean);
      const planId = segments[1];
      if (planId) {
        return NextResponse.redirect(new URL(`/plan/${planId}`, request.url));
      }
    }
    return response;
  }

  if (isProtectedAppPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!adminRow) {
      return NextResponse.redirect(new URL('/discover', request.url));
    }
  }

  if (isAuthPath(pathname) && user && pathname !== '/reset-password' && !pathname.startsWith('/reset-password/')) {
    const destination = await resolvePostAuthDestinationForUserId(supabase, user.id);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (user && isProtectedAppPath(pathname) && pathname !== '/onboarding' && !pathname.startsWith('/onboarding/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile?.onboarding_status === 'pending') {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth-hero|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
