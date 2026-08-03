import type { SupabaseClient } from '@supabase/supabase-js';

export type ConfirmSubscriptionPaymentResult = {
  activated: boolean;
  already?: boolean;
  tier?: string | null;
  error?: string;
};

export async function invokeConfirmSubscriptionPayment(
  client: SupabaseClient,
  txRef: string
): Promise<ConfirmSubscriptionPaymentResult> {
  const { data, error } = await client.functions.invoke('confirm-subscription-payment', {
    body: { tx_ref: txRef },
  });

  if (error) {
    return { activated: false, error: error.message };
  }

  const row = (data ?? {}) as {
    ok?: boolean;
    activated?: boolean;
    already?: boolean;
    tier?: string | null;
    error?: string;
  };

  if (row.error) {
    return { activated: false, error: row.error };
  }

  if (row.activated || row.already) {
    return {
      activated: true,
      already: row.already,
      tier: row.tier ?? null,
    };
  }

  return { activated: false, error: 'Subscription was not activated yet' };
}
