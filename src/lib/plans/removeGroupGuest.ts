import { createClient } from '@/lib/supabase/client';

export type RemoveGroupGuestReason = {
  reason_type: string;
  reason_text?: string;
};

export async function removeGroupGuest(
  planId: string,
  guestUserId: string,
  reason?: RemoveGroupGuestReason
): Promise<{ error: string | null; refunded?: boolean; amountCents?: number }> {
  const client = createClient();
  const { data, error } = await client.rpc('submit_group_host_remove_guest', {
    p_plan_id: planId,
    p_guest_user_id: guestUserId,
    p_reason_type: reason?.reason_type ?? null,
    p_reason_text: reason?.reason_text ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  const row = (data ?? {}) as {
    refund?: { refunded?: boolean; amount_cents?: number };
  };

  return {
    error: null,
    refunded: row.refund?.refunded === true,
    amountCents: row.refund?.amount_cents,
  };
}
