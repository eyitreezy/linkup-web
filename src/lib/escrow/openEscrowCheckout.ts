import { recordEscrowPaymentInitiated } from '@/lib/escrow/escrowActions';
import { getEscrowCallbackUrl } from '@/lib/flutterwave/callbackUrl';
import { openFlutterwaveCheckout } from '@/lib/flutterwave/openFlutterwaveCheckout';
import { extractPaymentLink } from '@/lib/flutterwave/paymentLink';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';

export type OpenEscrowCheckoutArgs = {
  escrowId: string;
  planId: string;
  escrowLeg?: 'host' | 'guest';
};

export async function openEscrowCheckout(args: OpenEscrowCheckoutArgs): Promise<{
  ok: boolean;
  error?: string;
  reference: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase is not configured. Escrow checkout requires create-escrow-payment on the server.',
      reference: '',
    };
  }

  const client = createClient();
  const { data, error } = await client.functions.invoke('create-escrow-payment', {
    body: {
      escrow_id: args.escrowId,
      plan_id: args.planId,
      escrow_leg: args.escrowLeg,
      redirect_url: getEscrowCallbackUrl(args.escrowId),
    },
  });

  if (error) {
    return { ok: false, error: error.message, reference: '' };
  }

  const row = data as { payment_link?: string; tx_ref?: string; error?: string } | null;
  let paymentLink: string;
  try {
    paymentLink = extractPaymentLink(data) ?? '';
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not start escrow checkout.',
      reference: '',
    };
  }
  if (!paymentLink || !row?.tx_ref) {
    return { ok: false, error: row?.error ?? 'Could not start escrow checkout.', reference: '' };
  }

  const opened = openFlutterwaveCheckout(paymentLink);
  if (!opened.ok) {
    return { ok: false, error: opened.error, reference: row.tx_ref };
  }

  await recordEscrowPaymentInitiated(client, args.escrowId, row.tx_ref);

  return { ok: true, reference: row.tx_ref };
}
