import type { SupabaseClient } from '@supabase/supabase-js';

export type VerifyEscrowPaymentResult = {
  funded: boolean;
  partial?: boolean;
  already?: boolean;
  fw_status?: string;
  error?: string;
};

function parseConfirmEscrowResponse(data: unknown): VerifyEscrowPaymentResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;

  if (row.error && row.ok !== true && row.funded !== true) {
    return { funded: false, error: String(row.error) };
  }

  const funded =
    row.funded === true ||
    row.already === true ||
    row.confirmed === true ||
    row.leg_funded === true ||
    row.guest_funded === true ||
    row.host_funded === true ||
    row.status === 'funded' ||
    row.status === 'active' ||
    row.status === 'released' ||
    (row.ok === true &&
      (row.partial === true ||
        row.already === true ||
        row.status === 'funded' ||
        row.leg_funded === true));

  if (funded) {
    return {
      funded: true,
      partial: row.partial === true,
      already: row.already === true,
    };
  }

  return null;
}

function parseVerifyFlutterwaveResponse(data: unknown): VerifyEscrowPaymentResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const partial = row.partial === true;
  const funded =
    row.funded === true ||
    partial ||
    row.already === true ||
    row.leg_funded === true ||
    row.status === 'funded';

  return {
    funded,
    partial,
    already: row.already === true,
    fw_status: typeof row.fw_status === 'string' ? row.fw_status : undefined,
    error: typeof row.error === 'string' ? row.error : undefined,
  };
}

export async function invokeVerifyEscrowPayment(
  client: SupabaseClient,
  escrowId: string,
  txRef?: string
): Promise<VerifyEscrowPaymentResult> {
  if (txRef) {
    const { data: confirmData, error: confirmErr } = await client.functions.invoke(
      'confirm-escrow-payment',
      { body: { escrow_id: escrowId, tx_ref: txRef } }
    );

    if (!confirmErr && confirmData) {
      const parsed = parseConfirmEscrowResponse(confirmData);
      if (parsed) return parsed;
    }
  }

  const { data, error } = await client.functions.invoke('verify-flutterwave-payment', {
    body: { escrow_id: escrowId, ...(txRef ? { tx_ref: txRef } : {}) },
  });

  if (error) {
    return { funded: false, error: error.message };
  }

  return parseVerifyFlutterwaveResponse(data);
}
