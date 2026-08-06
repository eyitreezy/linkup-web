'use client';

import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthButton, AuthInput, AuthPasswordInput, AuthTrustLine } from '@/components/auth/AuthFormPrimitives';
import { GoogleAuthBlock } from '@/features/auth/GoogleAuthBlock';
import { recordPrivacyConsent } from '@/lib/privacy/recordPrivacyConsent';
import {
  DUPLICATE_EMAIL_SIGNUP_MESSAGE,
  formatResendVerificationError,
  formatSignUpError,
  isDuplicateEmailSignup,
  isDuplicateSignUpError,
  normalizeAuthEmail,
} from '@/lib/auth/signupHelpers';
import { resolvePostAuthDestination } from '@/lib/auth/resolvePostAuthDestination';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { IoCheckmark, IoMailOpenOutline } from 'react-icons/io5';

function SignupFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/discover';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  async function onResendVerification() {
    setResendError(null);
    setResendNotice(null);
    setResendBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: normalizeAuthEmail(email),
        options: {
          emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next.startsWith('/') && !next.startsWith('//') ? next : '/discover')}`,
        },
      });
      if (err) {
        setResendError(formatResendVerificationError(err.message));
        return;
      }
      setResendNotice('Verification email sent again. Check your inbox and spam folder.');
    } catch {
      setResendError('Could not resend the email. Try again in a moment.');
    } finally {
      setResendBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowConsentError(false);
    const trimmedName = displayName.trim();
    const normalizedEmail = normalizeAuthEmail(email);
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!normalizedEmail) {
      setError('Please enter your email.');
      return;
    }
    if (!privacyConsentChecked) {
      setShowConsentError(true);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    setDuplicateEmail(false);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next.startsWith('/') && !next.startsWith('//') ? next : '/discover')}`,
          data: { display_name: trimmedName },
        },
      });
      if (err) {
        const formatted = formatSignUpError(err.message);
        if (isDuplicateSignUpError(err.message)) {
          setEmail(normalizedEmail);
          setDuplicateEmail(true);
          setError(null);
          return;
        }
        setError(formatted);
        return;
      }
      if (isDuplicateEmailSignup(data.user)) {
        setEmail(normalizedEmail);
        setDuplicateEmail(true);
        setError(null);
        return;
      }
      if (data.user) {
        await recordPrivacyConsent(data.user.id, 'signup');
      }
      if (!data.session) {
        setEmail(normalizedEmail);
        setVerificationSent(true);
        return;
      }
      const destination = await resolvePostAuthDestination(supabase, next);
      router.push(destination.startsWith('/') && !destination.startsWith('//') ? destination : '/discover');
      router.refresh();
    } catch {
      setError('Could not create account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (duplicateEmail) {
    return (
      <div className="auth-verify-card">
        <IoMailOpenOutline className="mx-auto text-secondary" size={32} />
        <h2 className="mt-3 font-display text-lg font-extrabold text-foreground max-lg:text-white">
          Account already exists
        </h2>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted max-lg:text-white/85">
          {DUPLICATE_EMAIL_SIGNUP_MESSAGE}{' '}
          <span className="font-extrabold text-foreground max-lg:text-white">{email}</span>
        </p>
        {resendNotice ? (
          <p className="mt-3 text-[13px] font-semibold leading-relaxed text-emerald-700 max-lg:text-emerald-200">
            {resendNotice}
          </p>
        ) : null}
        {resendError ? <p className="auth-error mt-3">{resendError}</p> : null}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="auth-btn-gradient linkup-gradient-primary mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-6 text-[15px] font-extrabold text-white shadow-md hover:opacity-95"
        >
          Log in
        </Link>
        <AuthButton
          type="button"
          fullWidth
          className="mt-2"
          disabled={resendBusy}
          onClick={() => void onResendVerification()}
        >
          {resendBusy ? 'Sending…' : 'Resend verification email'}
        </AuthButton>
        <AuthButton
          type="button"
          fullWidth
          className="mt-2"
          variant="ghost"
          onClick={() => {
            setDuplicateEmail(false);
            setResendNotice(null);
            setResendError(null);
          }}
        >
          Use a different email
        </AuthButton>
      </div>
    );
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
        {resendNotice ? (
          <p className="mt-3 text-[13px] font-semibold leading-relaxed text-emerald-700 max-lg:text-emerald-200">
            {resendNotice}
          </p>
        ) : null}
        {resendError ? <p className="auth-error mt-3">{resendError}</p> : null}
        <AuthButton
          type="button"
          fullWidth
          className="mt-4"
          disabled={resendBusy}
          onClick={() => void onResendVerification()}
        >
          {resendBusy ? 'Sending…' : 'Resend verification email'}
        </AuthButton>
        <AuthButton
          type="button"
          fullWidth
          className="mt-2"
          variant="ghost"
          onClick={() => {
            setVerificationSent(false);
            setResendNotice(null);
            setResendError(null);
          }}
        >
          Edit email
        </AuthButton>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="mb-6 h-[52px] animate-pulse rounded-full bg-white/10" />}>
        <GoogleAuthBlock
          mode="signup"
          privacyConsentChecked={privacyConsentChecked}
          onPrivacyConsentRequired={() => setShowConsentError(true)}
        />
      </Suspense>
      <form onSubmit={onSubmit} className="auth-form-stack space-y-3 max-lg:space-y-0">
        <AuthInput
          placeholder="Name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <AuthInput
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthPasswordInput
          autoComplete="new-password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <div className="flex items-start gap-2.5 pt-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={privacyConsentChecked}
            aria-label="Agree to Privacy Policy"
            onClick={() => {
              setPrivacyConsentChecked((checked) => !checked);
              setShowConsentError(false);
            }}
            className={cn(
              'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition',
              privacyConsentChecked
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-[#F8F9FC] max-lg:border-white/20 max-lg:bg-white/10'
            )}
          >
            {privacyConsentChecked ? <IoCheckmark size={12} aria-hidden /> : null}
          </button>
          <p className="text-[13px] font-semibold leading-snug text-muted max-lg:text-white/80">
            I agree to the{' '}
            <Link
              href="/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-foreground underline hover:no-underline max-lg:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
          </p>
        </div>
        {showConsentError ? (
          <p className="auth-error -mt-1">Please accept the Privacy Policy to continue</p>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <AuthButton type="submit" fullWidth disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </AuthButton>
        <p className="text-center text-[14px] font-semibold text-muted lg:block max-lg:hidden">
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-extrabold text-primary hover:underline">
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
