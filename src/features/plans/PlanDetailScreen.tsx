'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { BoostPill } from '@/components/plans/BoostPill';
import { PlanCardHero } from '@/components/plans/PlanCardHero';
import { PlanningTogetherHostCard } from '@/components/plans/PlanningTogetherHostCard';
import { VerificationGateDialog } from '@/components/plans/VerificationGateDialog';
import { PlanLocationMap } from '@/features/plans/PlanLocationMap';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import {
  formatOfferAmount,
  formatProposalSnippet,
  offerStatusChip,
  planIsAgreed,
  planningPartnerContext,
} from '@/features/plans/planDetailUtils';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { fetchPlanDetailBundle, type PlanDetailBundle } from '@/services/planDetail.service';
import type { PlanFeedRow } from '@/services/plans.service';
import { useTogglePlanSaved } from '@/features/saved/useTogglePlanSaved';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoLocationOutline,
  IoPricetagOutline,
  IoRocketOutline,
} from 'react-icons/io5';

type Props = {
  planId: string;
  initialPlan?: PlanFeedRow | null;
};

export function PlanDetailScreen({ planId, initialPlan }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const toggleSaved = useTogglePlanSaved(user?.id);

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

  const detailQuery = useQuery({
    queryKey: ['plan-detail', planId, user?.id],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchPlanDetailBundle(client, planId, user?.id ?? null);
      if (error) throw new Error(error);
      if (!data) throw new Error('Plan not found');
      return data;
    },
    initialData: initialPlan
      ? ({
          plan: initialPlan,
          offers: [],
          profilesById: {},
          saved: false,
          completionSelfAcked: false,
        } satisfies PlanDetailBundle)
      : undefined,
    staleTime: 15_000,
  });

  const bundle = detailQuery.data;
  const plan = bundle?.plan;
  const dbUser = profileQuery.data?.dbUser ?? null;
  const subscriber = isPremiumSubscriber(dbUser);

  const partnerCtx = useMemo(() => {
    if (!plan || !bundle) return null;
    return planningPartnerContext(plan, user?.id, bundle.offers, bundle.profilesById);
  }, [plan, user?.id, bundle]);

  const isCreator = !!user?.id && plan?.creator_id === user.id;
  const moodClosed = plan ? isPlanMoodWindowClosed(plan) : false;
  const agreed = plan ? planIsAgreed(plan.status) : false;
  const boosted = plan ? isPlanBoostActive(plan.boosted_until) : false;

  const viewerIsMatch = useMemo(() => {
    if (!plan || !user?.id || !plan.accepted_offer_id) return false;
    if (plan.creator_id === user.id) return true;
    const accepted = bundle?.offers.find((o) => o.id === plan.accepted_offer_id);
    return accepted?.bidder_id === user.id;
  }, [plan, user?.id, bundle?.offers]);

  function goNegotiate() {
    if (!isCreator && requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    router.push(`/plan/${planId}/negotiate`);
  }

  function toggleSave() {
    if (!user?.id || !plan) return;
    if (!subscriber) {
      router.push('/premium');
      return;
    }
    const next = !bundle?.saved;
    toggleSaved.mutate(
      { planId: plan.id, userId: user.id, saved: next, plan },
      {
        onError: (err) => {
          window.alert(err instanceof Error ? err.message : 'Could not update save');
        },
      }
    );
  }

  async function openCounterpartyChat() {
    if (!user?.id || !plan) return;
    const accepted = bundle?.offers.find((o) => o.id === plan.accepted_offer_id);
    if (!accepted) {
      window.alert('Could not find the accepted offer. Try refreshing.');
      return;
    }
    const other = plan.creator_id === user.id ? accepted.bidder_id : plan.creator_id;
    setChatBusy(true);
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, other);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setChatBusy(false);
    }
  }

  if (detailQuery.isLoading && !plan) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#EDE8FF]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#EDE8FF]/60" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Plan not found</p>
        <p className="mt-2 text-[14px] font-semibold text-muted">This plan may have been removed.</p>
        <Link href="/discover" className="mt-4 inline-block font-extrabold text-primary underline">
          Back to Discover
        </Link>
      </div>
    );
  }

  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan) ?? 'Open to offers';

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <VerificationGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />

      <PlanFlowHeader
        kicker="Meetup details"
        title={plan.title}
        subtitle={plan.location_label ?? undefined}
        backHref="/discover"
        backLabel="Back to Discover"
      />

      {moodClosed ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
          This mood moment has ended — you can still view details, but new offers are closed.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_8px_28px_rgba(42,31,85,0.08)]">
        <PlanCardHero plan={plan} className="h-52 md:h-60" />
        <div className="space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-display text-xl font-extrabold text-foreground md:text-2xl">{plan.title}</h2>
            <div className="flex flex-wrap gap-2">
              {boosted ? <BoostPill /> : null}
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold capitalize text-primary">
                {plan.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          {plan.description ? (
            <p className="text-[14px] font-semibold leading-relaxed text-muted">{plan.description}</p>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-3">
            <MetaItem icon={IoCalendarOutline} label="When" value={when} />
            <MetaItem icon={IoLocationOutline} label="Where" value={plan.location_label ?? 'TBD'} />
            <MetaItem icon={IoPricetagOutline} label="Price" value={price} />
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-[#EDE8FF]/40 to-[#FFF0F5]/50 p-5">
        <h3 className="font-display text-lg font-extrabold text-foreground">Planning together</h3>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          {partnerCtx?.mode === 'hosting'
            ? 'When you accept an offer, your match appears here.'
            : 'The person behind this meetup.'}
        </p>
        {partnerCtx?.mode === 'hosting' ? (
          <p className="mt-4 rounded-xl border border-dashed border-primary/25 bg-white/70 px-4 py-3 text-[13px] font-semibold text-muted">
            You&apos;re hosting — interested guests send offers, then you can match and chat.
          </p>
        ) : partnerCtx?.mode === 'person' ? (
          <PlanningTogetherHostCard
            profile={partnerCtx.profile}
            roleLabel={partnerCtx.roleLabel}
            userId={partnerCtx.otherUserId}
          />
        ) : null}
      </section>

      <ActionRail
        isCreator={isCreator}
        agreed={agreed}
        moodClosed={moodClosed}
        viewerIsMatch={viewerIsMatch}
        saved={!!bundle?.saved}
        saveBusy={toggleSaved.isPending}
        chatBusy={chatBusy}
        subscriber={subscriber}
        onSave={() => void toggleSave()}
        onNegotiate={goNegotiate}
        onAgreement={() => router.push(`/plan/${planId}/agreement`)}
        onChat={() => void openCounterpartyChat()}
        onPremium={() => router.push('/premium')}
      />

      <section className="linkup-card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-extrabold text-foreground">Recent offers</h3>
            {bundle && bundle.offers.length > 0 ? (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                {bundle.offers.length}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            {isCreator
              ? 'Everyone who has put forward an offer on this plan.'
              : 'Latest activity from people interested in this plan.'}
          </p>
        </div>
        {detailQuery.isFetching && !bundle?.offers.length ? (
          <p className="px-5 py-8 text-center text-[13px] font-semibold text-muted">Loading offers…</p>
        ) : !bundle?.offers.length ? (
          <div className="px-4 py-6">
            <AppEmptyState
              variant="compact"
              emoji="💡"
              title="No offers yet"
              description={
                isCreator
                  ? 'Share your plan — interested guests send suggestions from Discover or negotiate.'
                  : 'Be the first to say hello — send an offer with your timing and budget.'
              }
              action={{
                label: isCreator ? 'Manage offers' : 'Make offer',
                onClick: goNegotiate,
              }}
              className="border-0 bg-[#FAFAFF]/80 shadow-none"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {bundle.offers.map((offer) => {
              const chip = offerStatusChip(offer.status);
              const bidder = bundle.profilesById[offer.bidder_id];
              const whenSnippet = formatProposalSnippet(offer.proposed_scheduled_at);
              const isAccepted = offer.id === plan.accepted_offer_id;
              return (
                <li
                  key={offer.id}
                  className={cn('px-5 py-4', isAccepted && 'bg-emerald-500/[0.04]')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-foreground">
                        {bidder?.display_name?.trim() || 'Guest'}
                      </p>
                      <p className="text-[13px] font-semibold text-primary">
                        {formatOfferAmount(offer.amount_cents)}
                      </p>
                      {whenSnippet ? (
                        <p className="text-[12px] font-semibold text-muted">Proposed · {whenSnippet}</p>
                      ) : null}
                      {offer.message ? (
                        <p className="mt-1 line-clamp-2 text-[12px] font-semibold text-muted">{offer.message}</p>
                      ) : null}
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-extrabold', chip.className)}>
                      {chip.label}
                    </span>
                  </div>
                  {isAccepted ? (
                    <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                      Matched offer
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PlanLocationMap
        latitude={plan.latitude}
        longitude={plan.longitude}
        locationLabel={plan.location_label}
      />
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/40 bg-[#FAFAFF]/80 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="text-[13px] font-extrabold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function ActionRail({
  isCreator,
  agreed,
  moodClosed,
  viewerIsMatch,
  saved,
  saveBusy,
  chatBusy,
  subscriber,
  onSave,
  onNegotiate,
  onAgreement,
  onChat,
  onPremium,
}: {
  isCreator: boolean;
  agreed: boolean;
  moodClosed: boolean;
  viewerIsMatch: boolean;
  saved: boolean;
  saveBusy: boolean;
  chatBusy: boolean;
  subscriber: boolean;
  onSave: () => void;
  onNegotiate: () => void;
  onAgreement: () => void;
  onChat: () => void;
  onPremium: () => void;
}) {
  const primary =
    'rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50';
  const secondary =
    'rounded-full border border-primary/25 bg-white px-5 py-2.5 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50';

  if (isCreator) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className={secondary} disabled={moodClosed}>
          <span className="inline-flex items-center gap-2">
            <IoRocketOutline size={18} />
            Boost plan
          </span>
        </button>
        <button type="button" className={secondary} onClick={subscriber ? onNegotiate : onPremium}>
          Who is interested?
        </button>
        <button type="button" className={primary} onClick={onNegotiate}>
          Manage offers
        </button>
      </div>
    );
  }

  if (agreed && viewerIsMatch) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className={secondary} onClick={onSave} disabled={saveBusy}>
          {saved ? 'Saved' : 'Save plan'}
        </button>
        <button type="button" className={secondary} onClick={onAgreement}>
          <span className="inline-flex items-center gap-2">
            <IoDocumentTextOutline size={18} />
            View agreement
          </span>
        </button>
        <button type="button" className={primary} onClick={onChat} disabled={chatBusy}>
          <span className="inline-flex items-center gap-2">
            <IoChatbubbleEllipsesOutline size={18} />
            Message
          </span>
        </button>
      </div>
    );
  }

  if (agreed) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className={primary} onClick={onAgreement}>
          View agreement
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button type="button" className={secondary} onClick={onSave} disabled={saveBusy}>
        {saved ? 'Saved' : 'Save plan'}
      </button>
      <button type="button" className={primary} onClick={onNegotiate} disabled={moodClosed}>
        Make offer
      </button>
    </div>
  );
}
