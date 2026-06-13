'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { PlanGroupGuestsPanel } from '@/components/plans/PlanGroupGuestsPanel';
import { PlanInterestedStrip } from '@/components/plans/PlanInterestedStrip';
import { TierBadge } from '@/components/subscription/TierBadge';
import { BoostPill } from '@/components/plans/BoostPill';
import { PlanBoostControls } from '@/components/plans/PlanBoostControls';
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
import { createGroupChat } from '@/lib/messaging/createGroupChat';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { daysUntilIso, isPlanActiveWindowExpiringSoon } from '@/lib/plans/planActiveWindow';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { usePermission } from '@/hooks/usePermission';
import { extendMoodPlan } from '@/lib/plans/moodPlanCooldown';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import type { BoostQuotaMeta } from '@/lib/subscription/boostQuota';
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
import { useEffect, useMemo, useState } from 'react';
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoLocationOutline,
  IoPricetagOutline,
  IoLockClosed,
  IoTimeOutline,
} from 'react-icons/io5';

/** Auto-fit grid: buttons share a row until min cell width forces the next row. */
const planActionGrid =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-3';
const actionPrimary =
  'flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50';
const actionSecondary =
  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-5 py-2.5 text-[14px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50';

type Props = {
  planId: string;
  initialPlan?: PlanFeedRow | null;
};

export function PlanDetailScreen({ planId, initialPlan }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [gateOpen, setGateOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [groupChatBusy, setGroupChatBusy] = useState(false);
  const [groupChatConvId, setGroupChatConvId] = useState<string | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendMsg, setExtendMsg] = useState<string | null>(null);
  const toggleSaved = useTogglePlanSaved(user?.id);
  const {
    allowed: canBoost24,
    metadata: boost24Meta,
    refresh: refreshBoost24,
  } = usePermission('boost.24hr', { checkQuota: true });
  const {
    allowed: canBoost72,
    metadata: boost72Meta,
    refresh: refreshBoost72,
  } = usePermission('boost.72hr', { checkQuota: true });
  const { allowed: canExtendMood } = usePermission('mood_plan.extend');

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
  const runGated = useGatedAction();

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
    void runGated('plans.bookmark', () => {
      const next = !bundle?.saved;
      toggleSaved.mutate(
        { planId: plan.id, userId: user.id, saved: next, plan },
        {
          onError: (err) => {
            window.alert(err instanceof Error ? err.message : 'Could not update save');
          },
        }
      );
    });
  }

  async function handleExtendMood() {
    if (!user?.id || !plan) return;
    setExtendBusy(true);
    setExtendMsg(null);
    const result = await extendMoodPlan(plan.id, user.id);
    setExtendBusy(false);
    if (result.extended && result.new_expires_at) {
      setExtendMsg(`Plan extended until ${new Date(result.new_expires_at).toLocaleString('en-GB')}`);
      void detailQuery.refetch();
    } else {
      setExtendMsg(result.reason ?? 'Could not extend plan');
    }
  }

  useEffect(() => {
    if (!plan?.is_group_plan || !plan.id) return;
    const client = createClient();
    void client
      .from('conversations')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('is_group_chat', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setGroupChatConvId(data.id as string);
      });
  }, [plan?.id, plan?.is_group_plan]);

  async function handleOpenGroupChat() {
    if (!user?.id || !plan || groupChatBusy) return;
    setGroupChatBusy(true);
    try {
      if (groupChatConvId) {
        router.push(`/chat/group/${groupChatConvId}`);
        return;
      }
      if (plan.creator_id !== user.id) {
        window.alert('The host has not opened the group chat yet.');
        return;
      }
      const guestIds = (bundle?.offers ?? [])
        .filter((o) => o.status === 'accepted')
        .map((o) => o.bidder_id);
      const client = createClient();
      const convId = await createGroupChat(client, {
        planId: plan.id,
        hostId: user.id,
        groupName: plan.title,
        initialMemberIds: guestIds,
      });
      setGroupChatConvId(convId);
      router.push(`/chat/group/${convId}`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open group chat');
    } finally {
      setGroupChatBusy(false);
    }
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
              {plan.is_group_plan ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700 ring-1 ring-blue-200">
                  Group
                </span>
              ) : null}
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

      {isCreator &&
      plan.is_mood_plan &&
      !moodClosed &&
      (plan.status === 'negotiating' || plan.status === 'agreed') ? (
        <div className="rounded-2xl border border-border bg-white p-4">
          {canExtendMood ? (
            <button
              type="button"
              onClick={() => void handleExtendMood()}
              disabled={
                extendBusy ||
                ((plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM')
              }
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/25 bg-white text-[14px] font-extrabold text-primary disabled:opacity-50"
            >
              <IoTimeOutline size={18} />
              {extendBusy
                ? 'Extending…'
                : (plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM'
                  ? 'Extension used'
                  : 'Extend plan'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runGated('mood_plan.extend', () => {})}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-border text-[14px] font-extrabold text-muted opacity-80"
            >
              <IoLockClosed size={16} />
              Extend plan
              <TierBadge tier="GOLD" size="sm" />
            </button>
          )}
          {extendMsg ? (
            <p className="mt-2 text-center text-[12px] font-semibold text-muted">{extendMsg}</p>
          ) : null}
        </div>
      ) : null}

      <PlanGroupGuestsPanel plan={plan} hostUserId={plan.creator_id} currentUserId={user?.id} />

      {plan.is_group_plan && ['active', 'agreed'].includes(plan.status) ? (
        <button
          type="button"
          onClick={() => void handleOpenGroupChat()}
          disabled={groupChatBusy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-[14px] font-extrabold text-foreground transition hover:bg-[#F8F7FF] disabled:opacity-50 sm:w-auto"
        >
          <IoChatbubbleEllipsesOutline size={18} />
          Group chat
        </button>
      ) : null}

      {isCreator && user?.id ? (
        <PlanInterestedStrip planId={plan.id} hostUserId={plan.creator_id} currentUserId={user.id} />
      ) : null}

      {isCreator && user?.id && plan.active_expires_at && !plan.is_mood_plan ? (
        <div
          className={cn(
            'flex items-center gap-1.5 text-[12px] font-semibold',
            isPlanActiveWindowExpiringSoon(plan.active_expires_at)
              ? 'text-amber-700'
              : 'text-muted'
          )}
        >
          <IoTimeOutline size={14} className="shrink-0" aria-hidden />
          <span>
            {isPlanActiveWindowExpiringSoon(plan.active_expires_at)
              ? `Listing expires in ${daysUntilIso(plan.active_expires_at)} days`
              : `Listed until ${new Date(plan.active_expires_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`}
          </span>
        </div>
      ) : null}

      {isCreator && user?.id ? (
        <div className={planActionGrid}>
          <PlanBoostControls
            planId={plan.id}
            creatorId={plan.creator_id}
            dbUser={dbUser}
            boosted={boosted}
            boostedUntil={plan.boosted_until}
            moodClosed={moodClosed}
            canBoost24={canBoost24}
            canBoost72={canBoost72}
            boost24Meta={boost24Meta as BoostQuotaMeta | undefined}
            boost72Meta={boost72Meta as BoostQuotaMeta | undefined}
            onBoosted={() => void detailQuery.refetch()}
            onRefreshPermissions={() => {
              void refreshBoost24();
              void refreshBoost72();
            }}
          />
          <button type="button" className={actionPrimary} onClick={goNegotiate}>
            Manage offers
          </button>
        </div>
      ) : (
        <ActionRail
          agreed={agreed}
          moodClosed={moodClosed}
          viewerIsMatch={viewerIsMatch}
          saved={!!bundle?.saved}
          saveBusy={toggleSaved.isPending}
          chatBusy={chatBusy}
          onSave={() => void toggleSave()}
          onNegotiate={goNegotiate}
          onAgreement={() => router.push(`/plan/${planId}/agreement`)}
          onChat={() => void openCounterpartyChat()}
        />
      )}

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
  agreed,
  moodClosed,
  viewerIsMatch,
  saved,
  saveBusy,
  chatBusy,
  onSave,
  onNegotiate,
  onAgreement,
  onChat,
}: {
  agreed: boolean;
  moodClosed: boolean;
  viewerIsMatch: boolean;
  saved: boolean;
  saveBusy: boolean;
  chatBusy: boolean;
  onSave: () => void;
  onNegotiate: () => void;
  onAgreement: () => void;
  onChat: () => void;
}) {
  if (agreed && viewerIsMatch) {
    return (
      <div className={planActionGrid}>
        <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
          {saved ? 'Saved' : 'Save plan'}
        </button>
        <button type="button" className={actionSecondary} onClick={onAgreement}>
          <span className="inline-flex items-center gap-2">
            <IoDocumentTextOutline size={18} />
            View agreement
          </span>
        </button>
        <button type="button" className={actionPrimary} onClick={onChat} disabled={chatBusy}>
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
      <div className={planActionGrid}>
        <button type="button" className={actionPrimary} onClick={onAgreement}>
          View agreement
        </button>
      </div>
    );
  }

  return (
    <div className={planActionGrid}>
      <button type="button" className={actionSecondary} onClick={onSave} disabled={saveBusy}>
        {saved ? 'Saved' : 'Save plan'}
      </button>
      <button type="button" className={actionPrimary} onClick={onNegotiate} disabled={moodClosed}>
        Make offer
      </button>
    </div>
  );
}
