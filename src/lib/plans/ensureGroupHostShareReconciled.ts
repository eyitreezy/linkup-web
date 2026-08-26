import type { DbPlan } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type ReconcilePlanSnapshot = Pick<
  DbPlan,
  | 'id'
  | 'creator_id'
  | 'is_group_plan'
  | 'is_paid'
  | 'status'
  | 'accepted_guest_count'
  | 'max_guests'
>;

/** Idempotent: creates/updates pending host top-up escrow after guest removal. */
export async function ensureGroupHostShareReconciled(
  client: SupabaseClient,
  plan: ReconcilePlanSnapshot,
  viewerId: string
): Promise<void> {
  if (plan.creator_id !== viewerId) return;
  if (!plan.is_group_plan || !plan.is_paid) return;
  if (plan.status !== 'active' && plan.status !== 'awaiting_payment') return;

  const accepted = plan.accepted_guest_count ?? 0;
  const maxGuests = plan.max_guests ?? 0;
  if (accepted >= maxGuests) return;

  const { error } = await client.rpc('revalidate_group_plan_activation', {
    p_plan_id: plan.id,
  });
  if (error) {
    console.warn('[ensureGroupHostShareReconciled]', plan.id, error.message);
  }
}
