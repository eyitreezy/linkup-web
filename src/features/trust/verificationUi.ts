import type { UserVerification } from '@/types/database';

export type VerificationUiStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export function friendlyStatus(v: VerificationUiStatus): { title: string; sub: string } {
  switch (v) {
    case 'unverified':
      return { title: 'Not verified yet', sub: 'Complete verification to unlock plans, offers, and escrow.' };
    case 'pending':
      return {
        title: 'Review in progress',
        sub: "We're checking your documents. You'll get an in-app update—usually soon.",
      };
    case 'verified':
      return { title: 'Verified', sub: "You're cleared for trust-gated features across LinkUp." };
    case 'rejected':
      return {
        title: "Couldn't verify this round",
        sub: "Submit clearer documents if you'd like to retry.",
      };
    default:
      return { title: v, sub: '' };
  }
}

export function statusVisual(v: VerificationUiStatus) {
  switch (v) {
    case 'verified':
      return { pill: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30', icon: 'verified' as const };
    case 'pending':
      return { pill: 'bg-amber-500/15 text-amber-900 border-amber-500/30', icon: 'pending' as const };
    case 'rejected':
      return { pill: 'bg-red-500/10 text-red-700 border-red-500/30', icon: 'rejected' as const };
    default:
      return { pill: 'bg-primary/10 text-primary border-primary/25', icon: 'default' as const };
  }
}

export function toUiStatus(v: UserVerification | undefined): VerificationUiStatus {
  if (v === 'verified' || v === 'pending' || v === 'rejected') return v;
  return 'unverified';
}
