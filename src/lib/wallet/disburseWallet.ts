import { createClient } from '@/lib/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type DisburseWalletResult = {
  success: boolean;
  disbursement_id?: string;
  transfer_ref?: string;
  amount_cents?: number;
  error?: string;
};

type DisbursePayload = {
  error?: string;
  success?: boolean;
  disbursement_id?: string;
  transfer_ref?: string;
  amount_cents?: number;
};

function payloadIndicatesSuccess(payload: DisbursePayload | null | undefined): boolean {
  if (!payload) return false;
  return (
    payload.success === true ||
    !!payload.transfer_ref?.trim() ||
    !!payload.disbursement_id?.trim()
  );
}

function resultFromPayload(
  payload: DisbursePayload,
  fallbackAmountCents: number
): DisburseWalletResult {
  return {
    success: true,
    disbursement_id: payload.disbursement_id,
    transfer_ref: payload.transfer_ref,
    amount_cents: payload.amount_cents ?? fallbackAmountCents,
  };
}

async function parseInvokePayload(
  data: unknown,
  error: unknown
): Promise<DisbursePayload | null> {
  const merged: DisbursePayload = { ...((data as DisbursePayload | null) ?? {}) };

  if (error instanceof FunctionsHttpError) {
    try {
      const errorBody = (await error.context.json()) as DisbursePayload;
      Object.assign(merged, errorBody);
    } catch {
      // Non-JSON error bodies are ignored.
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findRecentDisbursementFallback(
  amountCents: number,
  startedAtIso: string
): Promise<DisburseWalletResult | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from('disbursement_requests')
    .select('id, amount_cents, flutterwave_transfer_ref, status, created_at')
    .eq('user_id', user.id)
    .eq('amount_cents', amountCents)
    .in('status', ['pending', 'processing', 'completed'])
    .gte('created_at', startedAtIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return null;

  const status = row.status as string;
  if (status !== 'processing' && status !== 'completed') {
    return null;
  }

  return {
    success: true,
    disbursement_id: row.id as string,
    transfer_ref: (row.flutterwave_transfer_ref as string | null) ?? undefined,
    amount_cents: row.amount_cents as number,
  };
}

async function findRecentFailedDisbursementMessage(
  amountCents: number,
  startedAtIso: string
): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from('disbursement_requests')
    .select('failure_reason, status, created_at')
    .eq('user_id', user.id)
    .eq('amount_cents', amountCents)
    .eq('status', 'failed')
    .gte('created_at', startedAtIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const reason = (rows?.[0]?.failure_reason as string | null)?.trim();
  return reason || null;
}

function friendlyDisbursementError(reason: string): string {
  if (/ip whitelisting/i.test(reason)) {
    return 'Bank payout is temporarily unavailable. Our payment provider requires IP whitelisting to be updated. Please try again later or contact support.';
  }
  return reason;
}

/** Edge functions that hit EarlyDrop may finish DB writes after the HTTP response is lost. */
async function waitForDisbursementFallback(
  amountCents: number,
  startedAtIso: string
): Promise<DisburseWalletResult | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const found = await findRecentDisbursementFallback(amountCents, startedAtIso);
    if (found) return found;
    if (attempt < 4) await sleep(2000);
  }
  return null;
}

export async function invokeDisburseWallet(input: {
  amountCents: number;
  paymentAccountId: string;
  queueItemId?: string;
}): Promise<DisburseWalletResult> {
  if (input.amountCents < 100) {
    return { success: false, error: 'Enter a valid withdrawal amount.' };
  }

  const supabase = createClient();
  const startedAtIso = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await supabase.functions.invoke('disburse-wallet', {
    body: {
      amount_cents: input.amountCents,
      payment_account_id: input.paymentAccountId,
      queue_item_id: input.queueItemId,
    },
  });

  const payload = await parseInvokePayload(data, error);

  if (payloadIndicatesSuccess(payload)) {
    return resultFromPayload(payload!, input.amountCents);
  }

  if (payload?.error?.trim()) {
    const fallback = await waitForDisbursementFallback(input.amountCents, startedAtIso);
    if (fallback) return fallback;
    const failedReason = await findRecentFailedDisbursementMessage(input.amountCents, startedAtIso);
    if (failedReason) return { success: false, error: friendlyDisbursementError(failedReason) };
    return { success: false, error: payload.error.trim() };
  }

  if (error) {
    const fallback = await waitForDisbursementFallback(input.amountCents, startedAtIso);
    if (fallback) return fallback;
    const failedReason = await findRecentFailedDisbursementMessage(input.amountCents, startedAtIso);
    if (failedReason) return { success: false, error: friendlyDisbursementError(failedReason) };

    if (error instanceof FunctionsHttpError) {
      return {
        success: false,
        error:
          'Your withdrawal is still processing. Refresh your wallet in a moment. If the balance dropped, the transfer likely succeeded.',
      };
    }

    return { success: false, error: error.message };
  }

  return { success: false, error: 'Withdrawal failed. Please try again.' };
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

  void supabase
    .rpc('unlock_plan_reviews', { p_plan_id: planId })
    .then(({ error: unlockError }) => {
      if (unlockError) console.error('[unlock_plan_reviews]', unlockError.message);
    });

  const row = data as { escrows_released?: number } | null;
  return { ok: true, escrowsReleased: row?.escrows_released ?? 0 };
}
