'use client';

import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthButton, AuthInput, AuthPasswordInput, AuthTrustLine } from '@/components/auth/AuthFormPrimitives';
import { GoogleAuthBlock } from '@/features/auth/GoogleAuthBlock';
import { EMAIL_CONFIRMED_LOGIN_MESSAGE, formatAuthCallbackError } from '@/lib/auth/authCallbackErrors';
import { normalizeAuthEmail } from '@/lib/auth/signupHelpers';
import { resolvePostAuthDestination } from '@/lib/auth/resolvePostAuthDestination';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/discover';
  const authError = searchParams.get('error');
  const authErrorDesc = searchParams.get('error_description');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    if (authError === 'email_confirmed') return EMAIL_CONFIRMED_LOGIN_MESSAGE;
    if (authError !== 'auth_callback') return null;
    if (authErrorDesc) {
      try {
        return formatAuthCallbackError(decodeURIComponent(authErrorDesc.replace(/\+/g, ' ')));
      } catch {
        return formatAuthCallbackError(authErrorDesc);
      }
    }
    return 'Sign-in could not be completed. Check Supabase redirect URLs and Google provider.';
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(email),
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      const destination = await resolvePostAuthDestination(supabase, next);
      router.push(destination);
      router.refresh();
    } catch {
      setError('Could not sign in. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Suspense fallback={<div className="mb-6 h-[52px] animate-pulse rounded-full bg-white/10" />}>
        <GoogleAuthBlock mode="login" />
      </Suspense>
      <form onSubmit={onSubmit} className="auth-form-stack space-y-3 max-lg:space-y-0">
        <AuthInput
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <AuthPasswordInput
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="mt-2 flex justify-end">
            <Link href="/forgot-password" className="auth-link text-[13px] font-bold text-primary max-lg:text-white/72">
              Forgot password?
            </Link>
          </div>
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <AuthButton type="submit" fullWidth disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </AuthButton>
        <p className="text-center text-[14px] font-semibold text-muted lg:block max-lg:hidden">
          New to LinkUp?{' '}
          <Link href="/signup" className="font-extrabold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </form>
      <AuthTrustLine />
    </>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<p className="text-muted max-lg:text-white/60">Loading…</p>}>
      <LoginFields />
    </Suspense>
  );
}
