import type { ProfileMini } from '@/services/planDetail.service';
import type { DbPlan, DbPlanOffer, OfferStatus, PlanStatus } from '@/types/database';

export function planningPartnerContext(
  plan: DbPlan,
  userId: string | undefined,
  offers: DbPlanOffer[],
  profiles: Record<string, ProfileMini>
):
  | { mode: 'hosting' }
  | { mode: 'person'; roleLabel: string; profile: ProfileMini | undefined; otherUserId: string } {
  if (!userId) {
    return {
      mode: 'person',
      roleLabel: 'Your host',
      profile: profiles[plan.creator_id],
      otherUserId: plan.creator_id,
    };
  }
  const accepted =
    offers.find((o) => o.id === plan.accepted_offer_id) ??
    offers.find((o) => o.status === 'accepted');
  if (userId === plan.creator_id) {
    if (accepted) {
      return {
        mode: 'person',
        roleLabel: 'Your match',
        profile: profiles[accepted.bidder_id],
        otherUserId: accepted.bidder_id,
      };
    }
    return { mode: 'hosting' };
  }
  return {
    mode: 'person',
    roleLabel: 'Your host',
    profile: profiles[plan.creator_id],
    otherUserId: plan.creator_id,
  };
}

export function planStatusChip(status: PlanStatus): { label: string; className: string } {
  const label = status.replace(/_/g, ' ');
  switch (status) {
    case 'negotiating':
      return { label: 'Negotiating', className: 'bg-[#EDE8FF] text-primary' };
    case 'agreed':
      return { label: 'Agreed', className: 'bg-emerald-500/12 text-emerald-700' };
    case 'awaiting_payment':
      return { label: 'Awaiting payment', className: 'bg-amber-500/12 text-amber-800' };
    case 'active':
      return { label: 'Active', className: 'bg-emerald-500/12 text-emerald-700' };
    case 'completed':
      return { label: 'Completed', className: 'bg-muted/15 text-muted' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-red-500/12 text-red-700' };
    case 'draft':
      return { label: 'Draft', className: 'bg-slate-500/12 text-slate-600' };
    default:
      return { label, className: 'bg-primary/10 text-primary capitalize' };
  }
}

export function offerStatusChip(status: OfferStatus): { label: string; className: string } {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', className: 'bg-emerald-500/12 text-emerald-700' };
    case 'pending':
      return { label: 'Awaiting response', className: 'bg-amber-500/12 text-amber-800' };
    case 'countered':
      return { label: 'Countered', className: 'bg-secondary/12 text-secondary' };
    case 'countered_by_host':
      return { label: 'Host countered', className: 'bg-primary/12 text-primary' };
    case 'countered_by_guest':
      return { label: 'Guest countered', className: 'bg-purple-500/12 text-purple-700' };
    case 'declined':
      return { label: 'Declined', className: 'bg-red-500/12 text-red-700' };
    case 'withdrawn':
      return { label: 'Withdrawn', className: 'bg-muted/15 text-muted' };
    case 'expired':
      return { label: 'Expired', className: 'bg-muted/20 text-muted' };
    case 'superseded':
      return { label: 'Superseded', className: 'bg-muted/15 text-muted' };
    default:
      return { label: status, className: 'bg-muted/15 text-muted' };
  }
}

export function formatProposalSnippet(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function planIsAgreed(status: string): boolean {
  return planIsPastNegotiation(status);
}

export function planIsPastNegotiation(status: string): boolean {
  return status === 'agreed' || status === 'awaiting_payment' || status === 'active' || status === 'completed';
}

export function formatOfferAmount(cents: number | null): string {
  if (cents == null || cents <= 0) return 'Open amount';
  return `₦${(cents / 100).toLocaleString('en-US')}`;
}
