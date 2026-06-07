import { env } from '@/lib/env';

/** Where the user should land after Paystack payment (web success page or mobile deep link). */
export function getPremiumPaystackCallbackUrl(): string {
  const custom = process.env.NEXT_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL?.trim();
  if (custom) return custom;
  return `${env.siteUrl}/premium/success`;
}

/**
 * Client-side guard — must match paystack-initialize (linkup supabase function).
 * http://localhost is bridged server-side to an HTTPS Supabase callback URL.
 */
export function isAllowedPaystackCallbackUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (/^https:\/\//i.test(u)) return true;
  if (/^linkup:\/\//i.test(u)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u)) return true;
  return false;
}

export function paystackCallbackUrlError(): string {
  return (
    'Use an https success URL (production), linkup://premium/success (mobile), or ' +
    'http://localhost:3000/premium/success for local web dev. ' +
    'Redeploy paystack-checkout-return if localhost checkout still fails.'
  );
}
