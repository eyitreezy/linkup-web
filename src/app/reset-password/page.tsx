'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton, AuthPasswordInput } from '@/components/auth/AuthFormPrimitives';
import { formatAuthCallbackError } from '@/lib/auth/authCallbackErrors';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { IoAlertCircleOutline } from 'react-icons/io5';

function ResetPasswordFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const recoveryError = searchParams.get('error');
    const desc = searchParams.get('error_description');
    if (recoveryError === 'link_expired') {
      return 'This reset link expired or was already used. Request a new one below.';
    }
    if (recoveryError === 'recovery_failed' && desc) {
      try {
        return formatAuthCallbackError(decodeURIComponent(desc.replace(/\+/g, ' ')));
      } catch {
        return formatAuthCallbackError(desc);
      }
    }
    return null;
  });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setError(formatAuthCallbackError(exchangeErr.message));
        }
        window.history.replaceState({}, '', '/reset-password');
      } else if (tokenHash && type === 'recovery') {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        if (otpErr) {
          setError(formatAuthCallbackError(otpErr.message));
        }
        window.history.replaceState({}, '', '/reset-password');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session?.user);
      setReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setHasSession(!!session?.user);
        setReady(true);
      }
    });

    void establishRecoverySession();
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(err.message);
    else {
      router.push('/discover');
      router.refresh();
    }
  }

  if (!ready) {
    return (
      <AuthShell variant="recovery" showHero={false}>
        <p className="text-center text-muted max-lg:text-white/60">Loading…</p>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell variant="recovery" showHero={false} title="Link expired">
        <div className="auth-verify-card">
          <IoAlertCircleOutline className="mx-auto text-[#F59E0B]" size={40} />
          <p className="mt-3 text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
            {error ??
              'Open the reset link from your email again, or request a new one from the sign-in screen.'}
          </p>
          <AuthButton type="button" fullWidth className="mt-4" onClick={() => router.replace('/login')}>
            Back to sign in
          </AuthButton>
          <Link
            href="/forgot-password"
            className="auth-link mt-3 block text-center text-[13px] font-bold max-lg:text-white/90"
          >
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="recovery"
      showHero={false}
      headingVariant="join-logo"
      subtitle="Choose something strong. You will use it to sign in to LinkUp."
    >
      <form onSubmit={onSubmit} className="auth-form-stack space-y-3 max-lg:space-y-0">
        <AuthPasswordInput
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <AuthPasswordInput
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <AuthButton type="submit" fullWidth disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </AuthButton>
        <Link href="/login" className="auth-link block text-center text-[13px] font-bold max-lg:mt-2">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell variant="recovery" showHero={false}>
          <p className="text-center text-muted max-lg:text-white/60">Loading…</p>
        </AuthShell>
      }
    >
      <ResetPasswordFields />
    </Suspense>
  );
}
