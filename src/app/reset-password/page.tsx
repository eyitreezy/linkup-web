'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton, AuthPasswordInput } from '@/components/auth/AuthFormPrimitives';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoAlertCircleOutline } from 'react-icons/io5';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session?.user);
      setReady(true);
    })();
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
            Open the reset link from your email again, or request a new one from the sign-in screen.
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
