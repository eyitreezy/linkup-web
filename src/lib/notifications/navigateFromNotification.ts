import type { NotificationPayload } from '@/types/database';

export function hrefFromNotificationPayload(data: NotificationPayload | null | undefined): string | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.href === 'string' && data.href.startsWith('/')) return data.href;
  if (data.chatId) return `/chat/${data.chatId}`;
  if (data.escrowId) return `/escrow/${data.escrowId}`;
  if (data.planId) return `/plan/${data.planId}`;
  if (data.disputeId) return '/disputes';
  return null;
}

export function navigateFromNotification(
  push: (href: string) => void,
  data: NotificationPayload | null | undefined
) {
  const tEarly = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (tEarly === 'premium_activated') {
    push('/premium/success');
    return;
  }

  const href = hrefFromNotificationPayload(data);
  if (href) {
    push(href);
    return;
  }

  const t = data && typeof data === 'object' && 'type' in data ? String((data as { type?: string }).type) : '';
  if (t === 'verification_submitted' || t === 'verification_updated' || t.startsWith('kyc_')) {
    push('/trust');
    return;
  }
  if (t === 'dispute_opened') {
    push('/support');
    return;
  }
  if (t.trim()) {
    push('/notifications');
  }
}
