'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Refetch offers dashboard when any plan offer changes. */
export function useOffersDashboardRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['offers-dashboard', userId] });
        void queryClient.invalidateQueries({ queryKey: ['offers-engagement-carousel', userId] });
      },
      { table: 'plan_offers' },
      { channelPrefix: 'offers-dashboard-rt' }
    );
  }, [userId, queryClient]);
}

/** Live negotiation thread for a single plan (offers + round history). */
export function usePlanOffersRealtime(planId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!planId) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-group-escrows', planId] });
      void queryClient.invalidateQueries({ queryKey: ['offer-rounds'] });
    };
    return subscribePostgresRealtime(
      invalidate,
      [
        { table: 'plan_offers', filter: `plan_id=eq.${planId}` },
        { table: 'plan_offer_rounds', filter: `plan_id=eq.${planId}`, event: 'INSERT' },
        { table: 'plans', filter: `id=eq.${planId}`, event: 'UPDATE' },
      ],
      { channelPrefix: 'plan-offers-rt' }
    );
  }, [planId, queryClient]);
}

/** Live negotiation history + offer row for a single offer card. */
export function useOfferRoundsRealtime(offerId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!offerId) return;
    return subscribePostgresRealtime(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['offer-rounds', offerId] });
        void queryClient.invalidateQueries({ queryKey: ['plan-offers'] });
      },
      [
        { table: 'plan_offer_rounds', filter: `offer_id=eq.${offerId}`, event: 'INSERT' },
        { table: 'plan_offers', filter: `id=eq.${offerId}` },
      ],
      { channelPrefix: 'offer-rounds-rt' }
    );
  }, [offerId, queryClient]);
}
