import { isHostedCheckoutUrl } from '@/lib/flutterwave/paymentLink';

/** Opens Flutterwave (or legacy Paystack) hosted checkout in a new tab (web). */
export function openFlutterwaveCheckout(paymentLink: string): { ok: boolean; error?: string } {
  const url = paymentLink.trim();

  if (url.startsWith('linkup://')) {
    return {
      ok: false,
      error:
        'Checkout returned a mobile app link. Redeploy create-subscription with Flutterwave and a web redirect URL.',
    };
  }

  if (!isHostedCheckoutUrl(url)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[checkout] Unexpected payment URL from server:', url.slice(0, 120));
    }
    return {
      ok: false,
      error:
        'Invalid checkout link from server. Ensure create-subscription is deployed and Flutterwave secrets are set in Supabase.',
    };
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    return {
      ok: false,
      error: 'Pop-up blocked. Allow pop-ups for LinkUp and try again.',
    };
  }

  return { ok: true };
}
