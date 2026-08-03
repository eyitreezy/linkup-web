'use client';

import { getSubscriptionCallbackUrl } from '@/lib/flutterwave/callbackUrl';
import { openFlutterwaveCheckout } from '@/lib/flutterwave/openFlutterwaveCheckout';
import { extractPaymentLink } from '@/lib/flutterwave/paymentLink';
import { clearPermissionCache } from '@/lib/subscription/checkPermission';
import { saveSubscriptionCheckoutTxRef } from '@/lib/subscription/subscriptionCheckoutSession';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import type { BillingCycle, PaidTier } from '@/lib/subscription/types';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useCallback, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 60_000;

export function useSubscription() {
  return useSubscriptionActions();
}

export function useSubscriptionActions() {
  const userId = useAuthStore((s) => s.user?.id);
  const { subscriptionState, refreshSubscription } = useSubscriptionContext();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollForTierChange = useCallback(
    (previousEffective: string, onSuccess?: () => void) => {
      stopPolling();
      const started = Date.now();
      pollRef.current = setInterval(() => {
        void (async () => {
          await refreshSubscription();
          const client = createClient();
          if (!userId) return;
          const { data } = await client
            .from('users')
            .select('subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber, billing_cycle')
            .eq('id', userId)
            .maybeSingle();
          if (!data) return;
          const { deriveSubscriptionState } = await import('@/lib/subscription/deriveState');
          const next = deriveSubscriptionState(data as Parameters<typeof deriveSubscriptionState>[0]);
          if (next.effectiveTier !== previousEffective || next.isPaidActive) {
            stopPolling();
            clearPermissionCache();
            onSuccess?.();
          } else if (Date.now() - started > POLL_MAX_MS) {
            stopPolling();
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [refreshSubscription, stopPolling, userId]
  );

  const initiateSubscription = useCallback(
    async (tier: PaidTier, billingCycle: BillingCycle): Promise<{ ok: boolean; error?: string }> => {
      if (!userId) return { ok: false, error: 'Sign in required' };
      setCheckoutBusy(true);
      const previousEffective = subscriptionState.effectiveTier;
      try {
        const client = createClient();
        const { data, error } = await client.functions.invoke('create-subscription', {
          body: {
            user_id: userId,
            tier,
            billing_cycle: billingCycle,
            redirect_url: getSubscriptionCallbackUrl(),
          },
        });
        if (error) throw new Error(error.message);
        const payload = data as { tx_ref?: string } | null;
        const link = extractPaymentLink(data);
        if (!link) throw new Error('No payment link returned from create-subscription');
        if (payload?.tx_ref) saveSubscriptionCheckoutTxRef(payload.tx_ref);
        const opened = openFlutterwaveCheckout(link);
        if (!opened.ok) throw new Error(opened.error ?? 'Could not open checkout');
        pollForTierChange(previousEffective);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed' };
      } finally {
        setCheckoutBusy(false);
      }
    },
    [userId, subscriptionState.effectiveTier, pollForTierChange]
  );

  const cancelSubscription = useCallback(async (): Promise<{ ok: boolean; error?: string; accessUntil?: string }> => {
    if (!userId) return { ok: false, error: 'Sign in required' };
    setCancelBusy(true);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke('cancel-subscription', {
        body: { user_id: userId },
      });
      if (error) throw new Error(error.message);
      clearPermissionCache();
      await refreshSubscription();
      return {
        ok: true,
        accessUntil: (data as { access_until?: string })?.access_until,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Cancel failed' };
    } finally {
      setCancelBusy(false);
    }
  }, [userId, refreshSubscription]);

  const activateGoldTrial = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) return { ok: false, error: 'Sign in required' };
    setTrialBusy(true);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke('activate-gold-trial', {
        body: { user_id: userId },
      });
      if (error) throw new Error(error.message);
      clearPermissionCache();
      await refreshSubscription();
      void data;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Trial activation failed' };
    } finally {
      setTrialBusy(false);
    }
  }, [userId, refreshSubscription]);

  return {
    initiateSubscription,
    cancelSubscription,
    activateGoldTrial,
    checkoutBusy,
    cancelBusy,
    trialBusy,
    stopPolling,
  };
}
