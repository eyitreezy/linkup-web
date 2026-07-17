'use client';

import { AuthDivider } from '@/components/auth/AuthDivider';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { signInWithGoogle } from '@/lib/auth/googleAuth';
import {
  clearPendingSignupPrivacyConsent,
  markPendingSignupPrivacyConsent,
} from '@/lib/privacy/pendingSignupConsentStorage';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Props = {
  mode: 'login' | 'signup';
  privacyConsentChecked?: boolean;
  onPrivacyConsentRequired?: () => void;
};

export function GoogleAuthBlock({ mode, privacyConsentChecked, onPrivacyConsentRequired }: Props) {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/discover';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGoogle() {
    setError(null);
    if (mode === 'signup' && !privacyConsentChecked) {
      onPrivacyConsentRequired?.();
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        markPendingSignupPrivacyConsent();
      }
      const { error: err } = await signInWithGoogle(next);
      if (err) {
        if (mode === 'signup') clearPendingSignupPrivacyConsent();
        setError(err.message);
        setLoading(false);
      }
    } catch {
      if (mode === 'signup') clearPendingSignupPrivacyConsent();
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <GoogleSignInButton
        onClick={() => void onGoogle()}
        loading={loading}
        label={mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
      />
      {error ? <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
      <AuthDivider
        label={mode === 'login' ? 'Or continue with email' : 'Or sign up with email'}
        tone="glass"
      />
    </div>
  );
}
