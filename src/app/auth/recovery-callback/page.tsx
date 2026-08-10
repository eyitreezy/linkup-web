'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import {
  establishRecoverySessionFromUrl,
  stripRecoveryCredentialsFromUrl,
} from '@/lib/auth/recoverySession';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

function RecoveryCallbackHandler() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const result = await establishRecoverySessionFromUrl(window.location.href);
      if (result.ok) {
        stripRecoveryCredentialsFromUrl();
        router.replace('/reset-password');
        return;
      }

      const params = new URLSearchParams();
      params.set('error', 'recovery_failed');
      params.set('error_description', result.message.slice(0, 200));
      router.replace(`/reset-password?${params.toString()}`);
    })();
  }, [router]);

  return (
    <AuthShell variant="recovery" showHero={false}>
      <p className="text-center text-muted max-lg:text-white/60">Verifying your reset link…</p>
    </AuthShell>
  );
}

/** Client recovery entry — handles token_hash, hash tokens, and PKCE code from email links. */
export default function RecoveryCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthShell variant="recovery" showHero={false}>
          <p className="text-center text-muted max-lg:text-white/60">Loading…</p>
        </AuthShell>
      }
    >
      <RecoveryCallbackHandler />
    </Suspense>
  );
}
