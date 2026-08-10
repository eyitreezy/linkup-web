'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthButton, AuthInput } from '@/components/auth/AuthFormPrimitives';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import Link from 'next/link';
import { useState } from 'react';
import { IoMailOpenOutline } from 'react-icons/io5';

export default function ForgotPasswordPage() {
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
      redirectTo: `${env.siteUrl}/auth/recovery-callback`,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <AuthShell
      variant="recovery"
      showHero={false}
      title="Reset your password"
      subtitle="Enter your email and we'll send a secure link to choose a new password."
    >
      <Link
        href="/login"
        className="auth-link mb-4 block text-left text-[13px] font-bold text-primary hover:underline max-lg:text-white/90"
      >
        ← Back to sign in
      </Link>

      {sent ? (
        <div className="auth-verify-card">
          <IoMailOpenOutline className="mx-auto text-secondary" size={32} />
          <h2 className="mt-3 font-display text-lg font-extrabold text-foreground max-lg:text-white">
            Check your email
          </h2>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
            We sent a reset link to{' '}
            <span className="font-extrabold text-foreground max-lg:text-white">{email}</span>. Open it on this
            device to set a new password.
          </p>
          <AuthButton type="button" fullWidth className="mt-4" variant="ghost" onClick={() => setSent(false)}>
            Edit email
          </AuthButton>
          <Link href="/login" className="auth-link mt-3 block text-center text-[13px] font-bold max-lg:text-white/90">
            Return to sign in
          </Link>
        </div>
      ) : (
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
      )}
    </AuthShell>
  );
}
