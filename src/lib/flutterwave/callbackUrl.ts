import { env } from '@/lib/env';

/** Web return URL after Flutterwave subscription payment (polling handles activation). */
export function getSubscriptionCallbackUrl(): string {
  return `${env.appUrl}/subscription/callback`;
}

/** Web return URL after escrow funding — polls escrow status before redirect. */
export function getEscrowCallbackUrl(escrowId: string): string {
  return `${env.appUrl}/escrow/callback?escrow_id=${encodeURIComponent(escrowId)}`;
}

export function isAllowedFlutterwaveCallbackUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https:\/\//i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(u);
}
