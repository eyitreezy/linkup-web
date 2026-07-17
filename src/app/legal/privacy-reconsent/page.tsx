'use client';

import { AuthButton } from '@/components/auth/AuthFormPrimitives';
import { recordPrivacyConsent } from '@/lib/privacy/recordPrivacyConsent';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PrivacyReconsentPage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [version, setVersion] = useState<DbPrivacyPolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('privacy_policy_versions')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVersion((data as DbPrivacyPolicyVersion | null) ?? null);
      setLoading(false);
    })();
  }, []);

  async function handleAccept() {
    if (!version || !userId || busy) return;
    setBusy(true);
    await recordPrivacyConsent(userId, 're_consent');
    setBusy(false);
    router.back();
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="font-display text-lg font-extrabold text-foreground">Updated Privacy Policy</h1>

        {loading ? (
          <p className="mt-4 text-[14px] font-semibold text-muted">Loading…</p>
        ) : (
          <>
            {version?.summary_of_changes ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-[#F5F6FA] p-4">
                <p className="text-[13px] font-extrabold text-foreground">What&apos;s changed</p>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
                  {version.summary_of_changes}
                </p>
              </div>
            ) : null}

            <Link
              href="/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[13px] font-extrabold text-primary hover:underline"
            >
              Read the full policy →
            </Link>

            <AuthButton
              type="button"
              fullWidth
              className="mt-6"
              disabled={busy || !version || !userId}
              onClick={() => void handleAccept()}
            >
              {busy ? 'Saving…' : 'I agree'}
            </AuthButton>
          </>
        )}
      </div>
    </div>
  );
}
