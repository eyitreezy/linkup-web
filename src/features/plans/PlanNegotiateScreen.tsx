'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { OfferBubble } from '@/features/plans/negotiation/OfferBubble';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { countOffersTowardLimit, MAX_OFFERS_PER_PLAN } from '@/lib/plans/offerRules';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { acceptPlanOffer } from '@/services/offers.service';
import { declinePlanOffer, fetchOffersForPlan, submitPlanOffer } from '@/services/planOffers.service';
import { fetchPlanById } from '@/services/plans.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';

type Props = { planId: string };

export function PlanNegotiateScreen({ planId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState('');

  const profileQuery = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      if (bundle.error) throw new Error(bundle.error);
      return bundle;
    },
    enabled: !!user?.id,
  });

  const planQuery = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchPlanById(client, planId);
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Plan not found');
      return data;
    },
  });

  const offersQuery = useQuery({
    queryKey: ['plan-offers', planId],
    queryFn: async () => {
      const client = createClient();
      return fetchOffersForPlan(client, planId, true);
    },
  });

  const plan = planQuery.data;
  const offers = offersQuery.data ?? [];
  const isCreator = !!user?.id && plan?.creator_id === user.id;
  const moodClosed = plan ? isPlanMoodWindowClosed(plan) : false;
  const canNegotiate = plan?.status === 'negotiating' && !moodClosed;
  const dbUser = profileQuery.data?.dbUser ?? null;

  const bidderNamesQuery = useQuery({
    queryKey: ['offer-bidders', planId, offers.map((o) => o.bidder_id).join(',')],
    queryFn: async () => {
      const ids = [...new Set(offers.map((o) => o.bidder_id))];
      if (ids.length === 0) return new Map<string, string>();
      const client = createClient();
      const { data } = await client
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        map.set(row.user_id as string, (row.display_name as string | null)?.trim() || 'Guest');
      }
      if (plan) map.set(plan.creator_id, plan.creator?.display_name?.trim() || 'Host');
      return map;
    },
    enabled: offers.length > 0 || !!plan,
  });

  const profilesByBidder = bidderNamesQuery.data ?? new Map<string, string>();

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !plan) throw new Error('Sign in to send an offer.');
      if (requiresVerificationGate(dbUser?.verification_status)) {
        setGateOpen(true);
        throw new Error('verification');
      }
      if (countOffersTowardLimit(offers) >= MAX_OFFERS_PER_PLAN) {
        throw new Error(`Offer limit reached (${MAX_OFFERS_PER_PLAN} rounds).`);
      }
      const cents = amount.trim() ? Math.round(Number(amount) * 100) : null;
      if (cents != null && (Number.isNaN(cents) || cents < 0)) {
        throw new Error('Enter a valid amount or leave blank.');
      }
      const client = createClient();
      const { error } = await submitPlanOffer(client, {
        plan,
        bidderId: user.id,
        amountCents: cents,
        message: note.trim() || null,
        proposedScheduledAt: proposedAt ? new Date(proposedAt).toISOString() : null,
        existingOffers: offers,
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      setAmount('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'verification') return;
      window.alert(e instanceof Error ? e.message : 'Could not send offer');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id || !plan) throw new Error('Not signed in');
      const offer = offers.find((o) => o.id === offerId);
      if (!offer) throw new Error('Offer not found');
      const client = createClient();
      const res = await acceptPlanOffer(client, {
        planId: plan.id,
        offer,
        plan,
        currentUserId: user.id,
      });
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] });
      router.push(`/plan/${planId}/agreement`);
    },
    onError: (e) => window.alert(e instanceof Error ? e.message : 'Could not accept'),
  });

  async function openDm() {
    if (!user?.id || !plan) return;
    const lastBidder = [...offers].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
    const other = isCreator ? lastBidder : plan.creator_id;
    if (!other) {
      window.alert(isCreator ? 'No offers yet — check back soon.' : 'Could not open chat.');
      return;
    }
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, other);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  if (planQuery.isLoading) {
    return <p className="text-[14px] font-semibold text-muted">Loading negotiation…</p>;
  }

  if (!plan) {
    return (
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">Plan not found</p>
        <Link href="/discover" className="mt-3 inline-block font-extrabold text-primary underline">
          Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />

      <PlanFlowHeader
        kicker="Offers"
        title={isCreator ? 'Manage offers' : 'Make an offer'}
        subtitle={plan.title}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
        right={
          <button
            type="button"
            onClick={() => void openDm()}
            className="flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-[13px] font-extrabold text-primary shadow-sm"
          >
            <IoChatbubbleEllipsesOutline size={18} />
            Open chat
          </button>
        }
      />

      <div className="linkup-card space-y-3 p-4 text-[13px] font-semibold text-muted">
        <p>
          {isCreator
            ? 'Review each suggestion — accept to move to agreement, or decline to keep negotiating.'
            : 'Propose amount, timing, and a note. Offers expire after 24 hours.'}
        </p>
      </div>

      <div className="space-y-4">
        {offers.length === 0 ? (
          <AppEmptyState
            emoji="🤝"
            title={isCreator ? 'Waiting for offers' : 'Start the conversation'}
            description={
              isCreator
                ? 'When guests send suggestions they appear here — accept to move to agreement.'
                : 'Send your first suggestion below with amount, time, and a friendly note.'
            }
            className="border border-dashed border-primary/20"
          />
        ) : null}
        {offers.map((offer) => (
          <OfferBubble
            key={offer.id}
            offer={offer}
            bidderName={profilesByBidder.get(offer.bidder_id) ?? 'Guest'}
            isOwn={offer.bidder_id === user?.id}
            isHost={isCreator}
            onAccept={() => acceptMutation.mutate(offer.id)}
            onDecline={async () => {
              const client = createClient();
              const { error } = await declinePlanOffer(client, offer.id);
              if (error) window.alert(error);
              else void queryClient.invalidateQueries({ queryKey: ['plan-offers', planId] });
            }}
            acceptBusy={acceptMutation.isPending}
          />
        ))}
      </div>

      {!isCreator && canNegotiate ? (
        <form
          className="linkup-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            sendMutation.mutate();
          }}
        >
          <h3 className="font-display text-lg font-extrabold text-foreground">Send a suggestion</h3>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Amount (₦, optional)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
              placeholder="e.g. 5000"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Proposed time</span>
            <input
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-extrabold text-muted">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold"
              placeholder="What would make this meetup work for you?"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {['Tonight works', 'Flexible on time', 'Happy to split cost'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNote((n) => (n.includes(chip) ? n : n ? `${n}\n${chip}` : chip))}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-extrabold text-primary"
              >
                {chip}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="w-full rounded-full linkup-gradient-primary py-3 text-[14px] font-extrabold text-white disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send suggestion'}
          </button>
        </form>
      ) : null}

      {moodClosed ? (
        <p className="text-center text-[13px] font-semibold text-amber-800">
          Mood window closed — new offers are not accepted.
        </p>
      ) : null}
    </div>
  );
}
