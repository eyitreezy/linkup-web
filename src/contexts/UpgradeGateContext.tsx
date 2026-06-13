'use client';

import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { checkPermission } from '@/lib/subscription/checkPermission';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { SubscriptionTier } from '@/lib/subscription/types';
import { useAuthStore } from '@/stores/auth-store';
import { requiresVerificationGate } from '@/lib/verification/access';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type UpgradePromptState = {
  isOpen: boolean;
  feature: string;
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
};

type UpgradeGateContextValue = {
  prompt: UpgradePromptState;
  showUpgradePrompt: (state: Omit<UpgradePromptState, 'isOpen'>) => void;
  closeUpgradePrompt: () => void;
  /** Layer 2 only — call after KYC gate passes. */
  checkFeaturePermission: (
    feature: string,
    options?: { checkQuota?: boolean }
  ) => Promise<{ allowed: boolean; upgradeTo?: SubscriptionTier; effectiveTier: SubscriptionTier }>;
  showKycGate: () => void;
  kycGateOpen: boolean;
  closeKycGate: () => void;
};

const closedPrompt: UpgradePromptState = {
  isOpen: false,
  feature: '',
  requiredTier: 'SILVER',
  currentTier: 'FREE',
};

const UpgradeGateContext = createContext<UpgradeGateContextValue | null>(null);

export function UpgradeGateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { dbUser } = useSubscriptionContext();
  const verificationStatus = dbUser?.verification_status;
  const [prompt, setPrompt] = useState<UpgradePromptState>(closedPrompt);
  const [kycGateOpen, setKycGateOpen] = useState(false);

  const showUpgradePrompt = useCallback((state: Omit<UpgradePromptState, 'isOpen'>) => {
    setPrompt({ ...state, isOpen: true });
  }, []);

  const closeUpgradePrompt = useCallback(() => {
    setPrompt(closedPrompt);
  }, []);

  const showKycGate = useCallback(() => setKycGateOpen(true), []);
  const closeKycGate = useCallback(() => setKycGateOpen(false), []);

  const checkFeaturePermission = useCallback(
    async (feature: string, options?: { checkQuota?: boolean }) => {
      if (!userId) {
        return { allowed: false, effectiveTier: 'FREE' as SubscriptionTier };
      }
      const result = await checkPermission(userId, feature, options);
      if (!result.allowed) {
        showUpgradePrompt({
          feature,
          requiredTier: result.upgradeTo ?? 'SILVER',
          currentTier: result.effectiveTier,
        });
      }
      return {
        allowed: result.allowed,
        upgradeTo: result.upgradeTo,
        effectiveTier: result.effectiveTier,
      };
    },
    [userId, showUpgradePrompt]
  );

  return (
    <UpgradeGateContext.Provider
      value={{
        prompt,
        showUpgradePrompt,
        closeUpgradePrompt,
        checkFeaturePermission,
        showKycGate,
        kycGateOpen,
        closeKycGate,
      }}
    >
      {children}
      <UpgradePrompt
        isOpen={prompt.isOpen}
        onClose={closeUpgradePrompt}
        feature={prompt.feature}
        requiredTier={prompt.requiredTier}
        currentTier={prompt.currentTier}
        onUpgrade={() => {
          closeUpgradePrompt();
          router.push(`/subscription?tier=${prompt.requiredTier}`);
        }}
      />
      {kycGateOpen ? (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="linkup-card max-w-md rounded-2xl p-6 shadow-xl">
            <h2 className="font-display text-lg font-extrabold text-foreground">Verify to continue</h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              Complete identity verification before using this feature — same trust rules as the LinkUp app.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  closeKycGate();
                  router.push('/kyc');
                }}
                className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white"
              >
                Start verification
              </button>
              <button
                type="button"
                onClick={closeKycGate}
                className="rounded-full border border-border px-5 py-2.5 text-[14px] font-extrabold text-muted"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UpgradeGateContext.Provider>
  );
}

export function useUpgradeGate(): UpgradeGateContextValue {
  const ctx = useContext(UpgradeGateContext);
  if (!ctx) throw new Error('useUpgradeGate must be used within UpgradeGateProvider');
  return ctx;
}

export function useGatedAction() {
  const { checkFeaturePermission, showKycGate } = useUpgradeGate();
  const { dbUser } = useSubscriptionContext();

  return useCallback(
    async (
      feature: string,
      action: () => void | Promise<void>,
      options?: { checkQuota?: boolean }
    ) => {
      if (requiresVerificationGate(dbUser?.verification_status)) {
        showKycGate();
        return;
      }
      const { allowed } = await checkFeaturePermission(feature, options);
      if (allowed) await action();
    },
    [checkFeaturePermission, showKycGate, dbUser?.verification_status]
  );
}
