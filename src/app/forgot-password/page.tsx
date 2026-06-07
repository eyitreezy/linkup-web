'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton, AuthInput } from '@/components/auth/AuthFormPrimitives';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoArrowBack, IoKeyOutline } from 'react-icons/io5';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${env.siteUrl}/reset-password`,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <AuthShell variant="recovery" showHero={false}>
      <button
        type="button"
        onClick={() => router.back()}
        className="auth-back-link max-lg:flex lg:hidden"
      >
        <IoArrowBack size={20} />
        Back
      </button>
      <Link href="/login" className="mb-4 hidden text-[13px] font-bold text-primary hover:underline lg:inline-block">
        ← Back to sign in
      </Link>

      {sent ? (
        <div className="space-y-4 text-center max-lg:text-center">
          <p className="text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
            Check your inbox for a reset link. Open it on this device to set a new password.
          </p>
          <Link href="/login" className="auth-link inline-block font-extrabold text-primary max-lg:text-white">
            Return to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="auth-recovery-head">
            <IoKeyOutline className="text-secondary" size={28} />
            <h1 className="auth-recovery-title">Reset your password</h1>
            <p className="auth-recovery-sub">
              Enter your email and we&apos;ll send a secure link. The link opens LinkUp so you can choose a new
              password.
            </p>
          </div>
          <form onSubmit={onSubmit} className="auth-form-stack space-y-3 max-lg:space-y-0">
            <AuthInput
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <p className="auth-error">{error}</p> : null}
            <AuthButton type="submit" fullWidth disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </AuthButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
