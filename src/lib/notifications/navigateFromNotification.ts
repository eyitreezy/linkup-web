import { adminHref } from '@/lib/admin/adminTabUrl';
import { planNegotiateHref } from '@/lib/plans/negotiateRoute';
import type { NotificationPayload } from '@/types/database';

export function hrefFromNotificationPayload(data: NotificationPayload | null | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.href === 'string' && data.href.startsWith('/')) {
    const adminTab = typeof data.adminTab === 'string' ? data.adminTab : undefined;
    if (data.href === '/admin' && adminTab) {
      return adminHref(adminTab);
    }
    if (
      data.href.includes('/negotiate') &&
      typeof data.offerId === 'string' &&
      data.offerId.trim() &&
      !data.href.includes('offerId=')
    ) {
      const sep = data.href.includes('?') ? '&' : '?';
      return `${data.href}${sep}offerId=${encodeURIComponent(data.offerId)}`;
    }
    return data.href;
  }
  if (typeof data.ticketId === 'string' && data.ticketId.length > 0) {
    return `/support/ticket/${data.ticketId}`;
  }
  if (data.chatId) return `/chat/${data.chatId}`;
  if (data.escrowId) return `/escrow/${data.escrowId}`;
  if (data.planId) {
    if (typeof data.offerId === 'string' && data.offerId.trim()) {
      return planNegotiateHref(data.planId, { offerId: data.offerId });
    }
    return `/plan/${data.planId}`;
  }
  if (data.disputeId) return '/disputes';
  return null;
}

function adminTabFromPayload(data: NotificationPayload | null | undefined, fallback?: string): string | undefined {
  if (data && typeof data === 'object' && typeof data.adminTab === 'string' && data.adminTab.trim()) {
    return data.adminTab;
  }
  return fallback;
}

export function navigateFromNotification(
  push: (href: string) => void,
  data: NotificationPayload | null | undefined
) {
  const tEarly = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (tEarly === 'premium_activated' || tEarly === 'subscription_activated') {
    push('/subscription');
    return;
  }

  const href = hrefFromNotificationPayload(data);
  if (href) {
    push(href);
    return;
  }

  const t = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (t === 'offer_received' || t === 'offer_countered') {
    if (data?.planId) {
      push(
        planNegotiateHref(data.planId, {
          offerId: typeof data.offerId === 'string' ? data.offerId : undefined,
          action: t === 'offer_countered' ? 'counter' : undefined,
        })
      );
      return;
    }
  }
  if (t === 'offer_accepted' && data?.planId) {
    push(`/plan/${data.planId}/agreement`);
    return;
  }
  if (t === 'offer_declined' && data?.planId) {
    push(`/plan/${data.planId}`);
    return;
  }
  if (t === 'verification_submitted' || t === 'verification_updated' || t.startsWith('kyc_')) {
    push('/trust');
    return;
  }
  if (t === 'dispute_opened') {
    push('/support');
    return;
  }
  if (t === 'credit_issued' || t === 'credit_expiring') {
    push('/wallet');
    return;
  }
  if (t === 'trial_started' || t === 'trial_expiring' || t === 'trial_expired') {
    push('/subscription');
    return;
  }
  if (t === 'report_submitted' || t === 'moderation_flagged' || t === 'meet_type_submitted') {
    push(
      adminHref(
        adminTabFromPayload(data, t === 'meet_type_submitted' ? 'meet_types' : undefined)
      )
    );
    return;
  }
  if (t === 'meet_type_approved' || t === 'meet_type_rejected') {
    push('/plan/create');
    return;
  }
  if (t === 'join_request_received' && data?.planId) {
    push(`/plan/${data.planId}/requests`);
    return;
  }
  if (t === 'join_request_approved') {
    if (data?.escrowId) {
      push(`/escrow/${data.escrowId}`);
      return;
    }
    if (data?.planId) {
      push(`/plan/${data.planId}/agreement`);
      return;
    }
  }
  if (t === 'join_request_declined') {
    push('/discover');
    return;
  }
  if (t === 'escrow_funded_bank_transfer' && data?.planId) {
    push(`/plan/${data.planId}/agreement`);
    return;
  }
  if (t === 'refund_initiated') {
    push('/wallet');
    return;
  }
  if (t === 'plan_invitation_received' && data?.planId && data?.invitationId) {
    push(`/plan/${data.planId}/invitation/${data.invitationId}`);
    return;
  }
  if (
    (t === 'plan_invitation_accepted' ||
      t === 'plan_invitation_declined' ||
      t === 'plan_invitation_expired') &&
    data?.planId
  ) {
    push(`/plan/${data.planId}/requests`);
    return;
  }
  if (t.trim()) {
    push('/notifications');
  }
}
