'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton } from '@/components/auth/AuthFormPrimitives';
import {
  EMAIL_CONFIRMED_LOGIN_MESSAGE,
  formatAuthCallbackError,
  isPkceVerifierError,
} from '@/lib/auth/authCallbackErrors';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { IoCheckmarkCircleOutline, IoAlertCircleOutline } from 'react-icons/io5';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/discover';
  return raw;
}

function EmailConfirmHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');

  const [phase, setPhase] = useState<'loading' | 'success' | 'login_required' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (oauthError) {
      const raw = oauthErrorDesc
        ? decodeURIComponent(oauthErrorDesc.replace(/\+/g, ' '))
        : oauthError;
      if (isPkceVerifierError(raw)) {
        setPhase('login_required');
        return;
      }
      setErrorMessage(formatAuthCallbackError(raw));
      setPhase('error');
      return;
    }

    if (!code) {
      setErrorMessage('Invalid confirmation link. Request a new one from the sign-up screen.');
      setPhase('error');
      return;
    }

    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        if (isPkceVerifierError(error.message)) {
          setPhase('login_required');
          return;
        }
        setErrorMessage(formatAuthCallbackError(error.message));
        setPhase('error');
        return;
      }

      setPhase('success');
      router.replace(next);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [code, oauthError, oauthErrorDesc, next, router]);

  if (phase === 'loading' || phase === 'success') {
    return (
      <AuthShell variant="recovery" showHero={false} title="Confirming your email">
        <p className="text-center text-[14px] font-semibold text-muted max-lg:text-white/85">
          {phase === 'success' ? 'Redirecting…' : 'One moment…'}
        </p>
      </AuthShell>
    );
  }

  if (phase === 'login_required') {
    return (
      <AuthShell variant="recovery" showHero={false} title="Email confirmed">
        <div className="auth-verify-card">
          <IoCheckmarkCircleOutline className="mx-auto text-emerald-600 max-lg:text-emerald-400" size={40} />
          <p className="auth-error mt-3">{EMAIL_CONFIRMED_LOGIN_MESSAGE}</p>
          <AuthButton type="button" fullWidth className="mt-4" onClick={() => router.replace(`/login?next=${encodeURIComponent(next)}`)}>
            Sign in
          </AuthButton>
          <p className="mt-3 text-center text-[13px] font-semibold text-muted max-lg:text-white/75">
            Opened the link in a different browser? That is normal — your account was still created.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="recovery" showHero={false} title="Confirmation issue">
      <div className="auth-verify-card">
        <IoAlertCircleOutline className="mx-auto text-[#F59E0B]" size={40} />
        {errorMessage ? <p className="auth-error mt-3">{errorMessage}</p> : null}
        <AuthButton type="button" fullWidth className="mt-4" onClick={() => router.replace('/login')}>
          Go to sign in
        </AuthButton>
        <Link href="/signup" className="auth-link mt-3 block text-center text-[13px] font-bold max-lg:text-white/90">
          Back to sign up
        </Link>
      </div>
    </AuthShell>
  );
}

export default function EmailConfirmPage() {
  return (
    <Suspense
      fallback={
        <AuthShell variant="recovery" showHero={false} title="Confirming your email">
          <p className="text-center text-muted max-lg:text-white/60">Loading…</p>
        </AuthShell>
      }
    >
      <EmailConfirmHandler />
    </Suspense>
  );
}
