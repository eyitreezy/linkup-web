import type { SupabaseClient } from '@supabase/supabase-js';
import type { RefundAccountResult } from '@/components/escrow/RefundAccountForm';
import { fetchNigerianBanks, verifyBankAccount } from '@/lib/escrow/virtualAccountPayment';

export type SubscriptionBankTransferSession = {
  sessionId: string;
  txRef: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  amountCents: number;
  expiresAt: string;
};

export async function createSubscriptionBankTransferSession(
  client: SupabaseClient,
  payload: {
    tier: 'SILVER' | 'GOLD' | 'PLATINUM';
    billingCycle: 'monthly' | 'annual';
    refundAccount?: RefundAccountResult | null;
  }
): Promise<{ session?: SubscriptionBankTransferSession; error?: string }> {
  const refundPayload =
    payload.refundAccount?.mode === 'saved'
      ? {
          refund_account_id: payload.refundAccount.accountId,
          one_time_refund_bank_code: null,
          one_time_refund_account_number: null,
          one_time_refund_account_name: null,
        }
      : payload.refundAccount?.mode === 'one_time'
        ? {
            refund_account_id: null,
            one_time_refund_bank_code: payload.refundAccount.bankCode,
            one_time_refund_account_number: payload.refundAccount.accountNumber,
            one_time_refund_account_name: payload.refundAccount.accountName,
          }
        : {
            refund_account_id: null,
            one_time_refund_bank_code: null,
            one_time_refund_account_number: null,
            one_time_refund_account_name: null,
          };

  const { data, error } = await client.functions.invoke('create-subscription-bank-transfer', {
    body: {
      tier: payload.tier,
      billing_cycle: payload.billingCycle,
      ...refundPayload,
    },
  });

  if (error) {
    return { error: error.message };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  if (typeof row.error === 'string') {
    return { error: row.error };
  }

  const sessionId = String(row.session_id ?? '');
  const txRef = String(row.tx_ref ?? '');
  if (!sessionId || !txRef) {
    return { error: 'No bank transfer session returned' };
  }

  return {
    session: {
      sessionId,
      txRef,
      accountNumber: String(row.account_number ?? ''),
      bankName: String(row.bank_name ?? ''),
      bankCode: String(row.bank_code ?? '035'),
      amountCents: Number(row.amount_cents ?? 0),
      expiresAt: String(row.expires_at ?? ''),
    },
  };
}

export async function syncSubscriptionFromBankTransfer(
  client: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { data, error } = await client.rpc('sync_subscription_from_bank_transfer', {
    p_session_id: sessionId,
  });
  if (error) {
    console.warn('[syncSubscriptionFromBankTransfer]', error.message);
    return false;
  }
  return data === true;
}

export async function checkSubscriptionBankTransferFunded(
  client: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { data, error } = await client.rpc('check_subscription_bank_transfer_funded', {
    p_session_id: sessionId,
  });
  if (error) {
    console.warn('[checkSubscriptionBankTransferFunded]', error.message);
    return false;
  }
  return data === true;
}

export async function confirmSandboxSubscriptionBankTransfer(
  client: SupabaseClient,
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await client.rpc('confirm_sandbox_subscription_bank_transfer', {
    p_session_id: sessionId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: data === true };
}

export { fetchNigerianBanks, verifyBankAccount };
