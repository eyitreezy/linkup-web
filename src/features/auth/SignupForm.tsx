'use client';

import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthButton, AuthInput, AuthTrustLine } from '@/components/auth/AuthFormPrimitives';
import { GoogleAuthBlock } from '@/features/auth/GoogleAuthBlock';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { IoMailOpenOutline } from 'react-icons/io5';

function SignupFields() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${env.siteUrl}/auth/callback`,
          data: { display_name: displayName.trim() || undefined },
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (!data.session) {
        setVerificationSent(true);
        return;
      }
      router.push('/discover');
      router.refresh();
    } catch {
      setError('Could not create account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="auth-verify-card">
        <IoMailOpenOutline className="mx-auto text-secondary" size={32} />
        <h2 className="mt-3 font-display text-lg font-extrabold text-foreground max-lg:text-white">
          Check your email
        </h2>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
          We sent a verification link to <span className="font-extrabold text-foreground max-lg:text-white">{email}</span>.
          Open it on this device to continue.
        </p>
        <AuthButton type="button" fullWidth className="mt-4" onClick={() => setVerificationSent(false)} variant="ghost">
          Edit email
        </AuthButton>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="mb-6 h-[52px] animate-pulse rounded-full bg-white/10" />}>
        <GoogleAuthBlock mode="signup" />
      </Suspense>
      <form onSubmit={onSubmit} className="auth-form-stack space-y-3 max-lg:space-y-0">
        <AuthInput
          placeholder="Name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <AuthInput
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthInput
          type="password"
          autoComplete="new-password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <AuthButton type="submit" fullWidth disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </AuthButton>
        <p className="text-center text-[14px] font-semibold text-muted lg:block max-lg:hidden">
          Already have an account?{' '}
          <Link href="/login" className="font-extrabold text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
      <AuthTrustLine />
    </>
  );
}

export function SignupForm() {
  return (
    <Suspense fallback={<p className="text-muted max-lg:text-white/60">Loading…</p>}>
      <SignupFields />
    </Suspense>
  );
}
