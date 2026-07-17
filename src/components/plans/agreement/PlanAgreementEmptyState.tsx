'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import {
  IoArrowBackOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoLockClosedOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

export type PlanAgreementEmptyReason =
  | 'no_offer'
  | 'not_found'
  | 'cancelled'
  | 'no_access'
  | 'unavailable';

type Props = {
  planId: string;
  reason: PlanAgreementEmptyReason;
  planTitle?: string | null;
};

export function resolveAgreementEmptyReason(
  error: unknown,
  hasPlan: boolean,
  hasOffer: boolean
): PlanAgreementEmptyReason {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (!hasPlan || message.includes('plan not found')) return 'not_found';
  if (message.includes('no access')) return 'no_access';
  if (!hasOffer || message.includes('no accepted offer')) return 'no_offer';
  if (message.includes('not available')) return 'unavailable';

  return 'unavailable';
}

export function PlanAgreementEmptyState({ planId, reason, planTitle }: Props) {
  const backHref = `/plan/${planId}`;
  const negotiateHref = `/plan/${planId}/negotiate`;

  const headerTitle =
    reason === 'cancelled'
      ? 'Plan cancelled'
      : reason === 'no_access'
        ? 'Agreement restricted'
        : 'Confirm plan';

  const headerSubtitle =
    planTitle?.trim() ||
    (reason === 'not_found' ? 'This plan could not be loaded.' : undefined);

  if (reason === 'no_offer') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <PlanFlowHeader kicker="Agreement" title={headerTitle} subtitle={headerSubtitle} backHref={backHref} />
        <AppEmptyState
          emoji="🤝"
          title="No agreement yet"
          titleAccent="agreement"
          description="An accepted offer is required before you can confirm this plan. Finish negotiation or wait for the host to accept your slot."
          tips={[
            {
              icon: IoDocumentTextOutline,
              text: 'Both people review the same summary before a plan goes active',
            },
            {
              icon: IoChatbubbleEllipsesOutline,
              text: 'Message from meetup details if timing or price still needs alignment',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Back to meetup details', href: backHref }}
          secondaryAction={{ label: 'Open negotiation', href: negotiateHref, variant: 'secondary' }}
        />
      </div>
    );
  }

  if (reason === 'not_found') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <PlanFlowHeader kicker="Agreement" title={headerTitle} backHref="/discover" backLabel="Back to Discover" />
        <AppEmptyState
          emoji="🔍"
          title="Plan not found"
          titleAccent="found"
          description="This meetup may have been removed or the link is no longer valid."
          action={{ label: 'Browse Discover', href: '/discover' }}
          secondaryAction={{ label: 'My plans', href: '/plans', variant: 'secondary' }}
        />
      </div>
    );
  }

  if (reason === 'cancelled') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <PlanFlowHeader kicker="Agreement" title={headerTitle} subtitle={headerSubtitle} backHref={backHref} />
        <AppEmptyState
          emoji="📋"
          title="Agreement ended"
          titleAccent="ended"
          description="This plan was cancelled and the agreement is no longer active. Any escrow refunds follow LinkUp cancellation policy."
          tips={[
            {
              icon: IoShieldCheckmarkOutline,
              text: 'Cancellation outcomes are enforced on LinkUp servers',
            },
            {
              icon: IoArrowBackOutline,
              text: 'Open meetup details to see the latest plan status',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Back to meetup details', href: backHref }}
          secondaryAction={{ label: 'Discover plans', href: '/discover', variant: 'secondary' }}
        />
      </div>
    );
  }

  if (reason === 'no_access') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <PlanFlowHeader kicker="Agreement" title={headerTitle} subtitle={headerSubtitle} backHref={backHref} />
        <AppEmptyState
          emoji="🔒"
          title="No access to this agreement"
          titleAccent="access"
          description="Only the host and accepted guest for this plan can review and confirm here."
          tips={[
            {
              icon: IoLockClosedOutline,
              text: 'Group plans use a separate agreement per accepted guest slot',
            },
            {
              icon: IoChatbubbleEllipsesOutline,
              text: 'Ask the host to share the correct plan link if you were invited',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Back to meetup details', href: backHref }}
          secondaryAction={{ label: 'Browse Discover', href: '/discover', variant: 'secondary' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PlanFlowHeader kicker="Agreement" title={headerTitle} subtitle={headerSubtitle} backHref={backHref} />
      <AppEmptyState
        emoji="⚠️"
        title="Agreement unavailable"
        titleAccent="unavailable"
        description="We could not load this confirmation screen right now. Check your connection and try again from meetup details."
        action={{ label: 'Back to meetup details', href: backHref }}
        secondaryAction={{ label: 'Try negotiation', href: negotiateHref, variant: 'secondary' }}
      />
    </div>
  );
}
