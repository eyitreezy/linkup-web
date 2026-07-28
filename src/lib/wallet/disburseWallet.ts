import { createClient } from '@/lib/supabase/client';

export type DisburseWalletResult = {
  success: boolean;
  disbursement_id?: string;
  transfer_ref?: string;
  amount_cents?: number;
  error?: string;
};

export async function invokeDisburseWallet(input: {
  amountCents: number;
  paymentAccountId: string;
  queueItemId?: string;
}): Promise<DisburseWalletResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('disburse-wallet', {
    body: {
      amount_cents: input.amountCents,
      payment_account_id: input.paymentAccountId,
      queue_item_id: input.queueItemId,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const payload = data as { error?: string; success?: boolean } | null;
  if (payload?.error) {
    return { success: false, error: payload.error };
  }

  return {
    success: true,
    disbursement_id: (payload as { disbursement_id?: string })?.disbursement_id,
    transfer_ref: (payload as { transfer_ref?: string })?.transfer_ref,
    amount_cents: (payload as { amount_cents?: number })?.amount_cents,
  };
}

export async function confirmMeetupHappened(planId: string): Promise<{
  ok: boolean;
  error?: string;
  escrowsReleased?: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('confirm_meetup_happened', {
    p_plan_id: planId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as { escrows_released?: number } | null;
  return { ok: true, escrowsReleased: row?.escrows_released ?? 0 };
}
