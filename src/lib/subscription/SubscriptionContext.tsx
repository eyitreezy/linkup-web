'use client';

import { deriveSubscriptionState } from '@/lib/subscription/deriveState';
import { clearPermissionCache } from '@/lib/subscription/checkPermission';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbUser } from '@/types/database';
import type { SubscriptionState } from '@/lib/subscription/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const USER_SUBSCRIPTION_FIELDS =
  'verification_status, subscription_tier, billing_cycle, subscription_expires_at, premium_until, silver_trial_activated_at, silver_trial_expires_at, gold_trial_activated_at, gold_trial_expires_at, has_been_silver_subscriber';

type SubscriptionContextValue = {
  subscriptionState: SubscriptionState;
  dbUser: DbUser | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
};

const defaultState = deriveSubscriptionState(null);

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscriptionState: defaultState,
  dbUser: null,
  loading: true,
  refreshSubscription: async () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (!authUser?.id) {
      setDbUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();
    const { data, error } = await client
      .from('users')
      .select(USER_SUBSCRIPTION_FIELDS)
      .eq('id', authUser.id)
      .maybeSingle();

    if (!error && data) {
      setDbUser((prev) => ({ ...(prev ?? { id: authUser.id }), ...data }) as DbUser);
    }
    setLoading(false);
  }, [authUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser?.id) {
      setDbUser(null);
      setLoading(false);
      clearPermissionCache();
      return;
    }
    void refreshSubscription();
  }, [authUser?.id, authLoading, refreshSubscription]);

  useEffect(() => {
    if (!authUser?.id) return;
    const client = createClient();
    const channel = client
      .channel(`subscription:${authUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${authUser.id}` },
        () => {
          void refreshSubscription();
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [authUser?.id, refreshSubscription]);

  const subscriptionState = useMemo(() => deriveSubscriptionState(dbUser), [dbUser]);

  const value = useMemo(
    () => ({
      subscriptionState,
      dbUser,
      loading: authLoading || loading,
      refreshSubscription: async () => {
        clearPermissionCache();
        await refreshSubscription();
      },
    }),
    [subscriptionState, dbUser, authLoading, loading, refreshSubscription]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
