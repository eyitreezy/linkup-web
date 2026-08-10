'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton, AuthPasswordInput } from '@/components/auth/AuthFormPrimitives';
import {
  formatRecoveryAuthError,
  PASSWORD_RESET_EXPIRED_MESSAGE,
} from '@/lib/auth/recoveryErrors';
import { getPasswordValidationErrors } from '@/lib/auth/passwordValidation';
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
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(() => {
    const recoveryError = searchParams.get('error');
    const desc = searchParams.get('error_description');
    if (recoveryError === 'link_expired' || recoveryError === 'recovery_failed') {
      if (desc) {
        try {
          return formatRecoveryAuthError(decodeURIComponent(desc.replace(/\+/g, ' ')));
        } catch {
          return formatRecoveryAuthError(desc);
        }
      }
      return PASSWORD_RESET_EXPIRED_MESSAGE;
    }
    return null;
  });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishRecoverySession() {
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
        if (event === 'PASSWORD_RECOVERY') setError(null);
      }
    });

    void establishRecoverySession();
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nextPasswordErrors = getPasswordValidationErrors(password);
    if (nextPasswordErrors.length > 0) {
      setPasswordErrors(nextPasswordErrors);
      return;
    }
    setPasswordErrors([]);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(formatRecoveryAuthError(err.message));
    else {
      router.push('/login?reset=success');
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
            {error ?? PASSWORD_RESET_EXPIRED_MESSAGE}
          </p>
          <Link href="/forgot-password">
            <AuthButton type="button" fullWidth className="mt-4">
              Request a new reset link
            </AuthButton>
          </Link>
          <AuthButton type="button" fullWidth variant="ghost" className="mt-2" onClick={() => router.replace('/login')}>
            Back to sign in
          </AuthButton>
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
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordErrors.length > 0) {
              setPasswordErrors(getPasswordValidationErrors(e.target.value));
            }
          }}
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
        {passwordErrors.length > 0 ? (
          <div className="space-y-1">
            {passwordErrors.map((msg) => (
              <p key={msg} className="auth-error">
                {msg}
              </p>
            ))}
          </div>
        ) : null}
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
