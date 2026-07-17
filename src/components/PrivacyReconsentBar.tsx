'use client';

import { PrivacyReconsentBanner } from '@/components/PrivacyReconsentBanner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function PrivacyReconsentBar() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const authLoading = useAuthStore((s) => s.loading);
  const [needsPrivacyReconsent, setNeedsPrivacyReconsent] = useState(false);
  const [reconsentBannerDismissed, setReconsentBannerDismissed] = useState(false);

  useEffect(() => {
    if (!userId || authLoading) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('user_needs_privacy_reconsent', {
        p_user_id: userId,
      });
      if (cancelled) return;
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[privacy] reconsent check:', error.message);
        }
        setNeedsPrivacyReconsent(false);
        return;
      }
      setNeedsPrivacyReconsent(!!data);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  if (!needsPrivacyReconsent || reconsentBannerDismissed) return null;

  return (
    <PrivacyReconsentBanner
      onReview={() => router.push('/legal/privacy-reconsent')}
      onDismiss={() => setReconsentBannerDismissed(true)}
    />
  );
}
