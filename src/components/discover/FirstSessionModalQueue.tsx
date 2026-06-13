'use client';

import { SoftKycPrompt } from '@/components/kyc/SoftKycPrompt';
import { GoldTrialWelcomeModal } from '@/components/subscription/GoldTrialWelcomeModal';
import { SilverTrialWelcomeModal } from '@/components/subscription/SilverTrialWelcomeModal';
import { hasActiveGoldTrial, hasActiveSilverTrial } from '@/lib/subscription/effectiveTier';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { isUserVerified } from '@/lib/verification/access';
import { consumeSoftKycPromptPending, peekSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type FirstSessionModal = 'silverWelcome' | 'goldWelcome' | 'softKyc';

export function FirstSessionModalQueue() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { dbUser } = useSubscriptionContext();
  const modalQueueRef = useRef<FirstSessionModal[]>([]);
  const [activeModal, setActiveModal] = useState<FirstSessionModal | null>(null);

  useEffect(() => {
    if (!user?.id || !dbUser) return;

    void (async () => {
      const queue: FirstSessionModal[] = [];

      if (dbUser.silver_trial_activated_at && hasActiveSilverTrial(dbUser)) {
        const seen = localStorage.getItem(`silver_trial_welcome_seen_${user.id}`);
        if (!seen) queue.push('silverWelcome');
      }

      if (hasActiveGoldTrial(dbUser)) {
        const seen = localStorage.getItem(`gold_trial_welcome_seen_${user.id}`);
        if (!seen) queue.push('goldWelcome');
      }

      if (!isUserVerified(dbUser.verification_status)) {
        const pending = await peekSoftKycPromptPending();
        if (pending) queue.push('softKyc');
      }

      modalQueueRef.current = queue;
      setActiveModal(queue[0] ?? null);
    })();
  }, [
    user?.id,
    dbUser?.id,
    dbUser?.verification_status,
    dbUser?.silver_trial_activated_at,
    dbUser?.silver_trial_expires_at,
    dbUser?.gold_trial_expires_at,
    dbUser?.subscription_tier,
  ]);

  useEffect(() => {
    if (activeModal === 'softKyc') {
      void consumeSoftKycPromptPending();
    }
    if (activeModal === 'goldWelcome' && user?.id) {
      localStorage.setItem(`gold_trial_welcome_seen_${user.id}`, '1');
    }
  }, [activeModal, user?.id]);

  const advanceModalQueue = useCallback(() => {
    modalQueueRef.current = modalQueueRef.current.slice(1);
    setActiveModal(modalQueueRef.current[0] ?? null);
  }, []);

  return (
    <>
      <SilverTrialWelcomeModal
        open={activeModal === 'silverWelcome'}
        onOpenChange={(open) => {
          if (!open) {
            if (user?.id) {
              localStorage.setItem(`silver_trial_welcome_seen_${user.id}`, '1');
            }
            advanceModalQueue();
          }
        }}
      />
      <GoldTrialWelcomeModal
        open={activeModal === 'goldWelcome'}
        onOpenChange={(open) => {
          if (!open) advanceModalQueue();
        }}
      />
      <SoftKycPrompt
        open={activeModal === 'softKyc'}
        onOpenChange={(open) => {
          if (!open) advanceModalQueue();
        }}
        onVerify={() => router.push('/trust')}
      />
    </>
  );
}
