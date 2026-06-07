import {
  getPremiumPaystackCallbackUrl,
  isAllowedPaystackCallbackUrl,
  paystackCallbackUrlError,
} from '@/lib/paystack/callbackUrl';
import { invokePaystackInitialize } from '@/lib/paystack/invokePaystackInitialize';
import type { PremiumTier } from '@/lib/premium/catalog';
import { isSupabaseConfigured } from '@/lib/env';

export async function openPremiumPaystackCheckout(opts: {
  email: string;
  userId: string;
  tier: PremiumTier;
}): Promise<{ ok: boolean; error?: string; reference: string }> {
  if (!opts.email?.trim()) {
    return { ok: false, error: 'Add an email to your account.', reference: '' };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase is not configured. Premium checkout requires paystack-initialize.',
      reference: '',
    };
  }

  const callbackUrl = getPremiumPaystackCallbackUrl();
  if (!isAllowedPaystackCallbackUrl(callbackUrl)) {
    return { ok: false, error: paystackCallbackUrlError(), reference: '' };
  }

  const init = await invokePaystackInitialize({
    kind: 'premium',
    email: opts.email.trim(),
    callback_url: callbackUrl,
    tier_id: opts.tier.id,
  });

  if (!init.ok) {
    return { ok: false, error: init.error, reference: '' };
  }

  window.open(init.data.authorization_url, '_blank', 'noopener,noreferrer');
  return { ok: true, reference: init.data.reference };
}
