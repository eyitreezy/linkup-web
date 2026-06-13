import type { DbNotification, NotificationEventType, NotificationPayload } from '@/types/database';

export type NotificationFilterTab = 'all' | 'activity' | 'payments' | 'system';

export const FILTER_TAB_ORDER: NotificationFilterTab[] = ['all', 'activity', 'payments', 'system'];

const ACTIVITY: NotificationEventType[] = [
  'offer_new',
  'offer_counter',
  'mutual_agreement',
  'agreement_confirmed',
  'agreement_update',
  'plan_reminder',
  'payment_reminder',
  'plan_cancelled',
  'message',
];

const PAYMENTS: NotificationEventType[] = [
  'escrow_funded',
  'escrow_status',
  'completion_release',
  'cancel_chargeback',
  'dispute_opened',
  'dispute_created',
  'dispute_updated',
  'dispute_resolved',
  'wallet_updated',
  'credit_issued',
  'credit_expiring',
];

const SYSTEM: NotificationEventType[] = [
  'kyc_submitted',
  'kyc_decision',
  'verification_submitted',
  'verification_updated',
  'moderation_flagged',
  'account_restriction',
  'report_submitted',
  'premium_activated',
  'trial_started',
  'trial_expiring',
  'trial_expired',
  'strike_added',
  'user_suspended',
  'user_banned',
];

/** Prefer the row `type` column; fall back to `data.type` for legacy payloads. */
export function resolveNotificationEventType(
  notification: Pick<DbNotification, 'type'> & { data?: NotificationPayload | null }
): string {
  const columnType = typeof notification.type === 'string' ? notification.type.trim() : '';
  if (columnType) return columnType;
  const dataType =
    notification.data && typeof notification.data === 'object' && 'type' in notification.data
      ? String((notification.data as { type?: string }).type ?? '').trim()
      : '';
  return dataType;
}

export function notificationTab(type: string): NotificationFilterTab {
  const t = type.trim();
  if (!t) return 'activity';
  if (ACTIVITY.includes(t as NotificationEventType)) return 'activity';
  if (PAYMENTS.includes(t as NotificationEventType)) return 'payments';
  if (SYSTEM.includes(t as NotificationEventType)) return 'system';
  if (t.startsWith('offer_') || t.startsWith('plan_') || t.startsWith('agreement_')) return 'activity';
  if (t.startsWith('escrow_') || t.startsWith('dispute') || t.startsWith('wallet_') || t.startsWith('credit_')) {
    return 'payments';
  }
  if (
    t.startsWith('kyc_') ||
    t.startsWith('account_') ||
    t.startsWith('verification_') ||
    t.startsWith('user_') ||
    t.startsWith('strike_') ||
    t.startsWith('moderation_') ||
    t.startsWith('report_') ||
    t.startsWith('trial_') ||
    t === 'premium_activated'
  ) {
    return 'system';
  }
  return 'activity';
}

export function notificationMatchesFilter(
  notification: Pick<DbNotification, 'type'> & { data?: NotificationPayload | null },
  filter: NotificationFilterTab
): boolean {
  if (filter === 'all') return true;
  return notificationTab(resolveNotificationEventType(notification)) === filter;
}

export const FILTER_LABELS: Record<NotificationFilterTab, string> = {
  all: 'All',
  activity: 'Activity',
  payments: 'Payments',
  system: 'System',
};
