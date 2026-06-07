import { resolveEscrowParties } from '@/lib/plans/escrowParties';
import { MAX_ESCROW_TIER1_CENTS, MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgreementActionResult = { error: string | null; escrowId?: string };

export async function confirmFreePlan(
  client: SupabaseClient,
  planId: string
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('plans')
    .update({ status: 'active' })
    .eq('id', planId)
    .eq('status', 'agreed');
  if (error) return { error: error.message };
  return { error: null };
}

export async function proceedToSecurePayment(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer
): Promise<AgreementActionResult> {
  if (!plan.is_paid) {
    return { error: 'This plan is free — no escrow step.' };
  }

  const amount = plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0;
  if (amount <= 0) return { error: 'No payment amount for this plan.' };
  if (amount < MIN_ESCROW_CENTS) {
    return { error: `Minimum escrow is ₦${MIN_ESCROW_CENTS / 100} per policy.` };
  }
  if (amount > MAX_ESCROW_TIER1_CENTS) {
    return { error: 'Amount exceeds Tier 1 limit — Tier 2 (BVN) required (coming soon).' };
  }

  const pattern = plan.escrow_pattern;
  if (!pattern) return { error: 'Escrow pattern missing on plan.' };

  if (pattern === 'C') {
    const { data: hostU } = await client.from('users').select('kyc_tier').eq('id', plan.creator_id).maybeSingle();
    const { data: guestU } = await client.from('users').select('kyc_tier').eq('id', offer.bidder_id).maybeSingle();
    const ht = (hostU?.kyc_tier as number) ?? 1;
    const gt = (guestU?.kyc_tier as number) ?? 1;
    if (ht < 2 || gt < 2) {
      return { error: 'Guest-funded plans require Tier 2 verification for both you and your guest.' };
    }
  }

  const { payerId, payeeId, hostShareCents, guestShareCents } = resolveEscrowParties(
    plan,
    offer.bidder_id,
    amount
  );

  const hostId = plan.creator_id;
  const guestId = offer.bidder_id;

  const fundingDeadline = plan.is_mood_plan
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await client
    .from('escrow_transactions')
    .select('id')
    .eq('plan_id', plan.id)
    .maybeSingle();
  if (existing?.id) {
    const { error: e1 } = await client.from('plans').update({ status: 'awaiting_payment' }).eq('id', plan.id);
    if (e1) return { error: e1.message };
    return { error: null, escrowId: existing.id as string };
  }

  const { data: esc, error: e2 } = await client
    .from('escrow_transactions')
    .insert({
      plan_id: plan.id,
      payer_id: payerId,
      payee_id: payeeId,
      host_id: hostId,
      guest_id: guestId,
      escrow_pattern: pattern,
      amount_cents: amount,
      host_share_cents: hostShareCents,
      guest_share_cents: guestShareCents,
      funding_deadline: fundingDeadline,
      currency: plan.currency,
      status: 'pending_funding',
      metadata: pattern === 'B' ? { legs: 'split', phase: 'awaiting_host' } : {},
    })
    .select('id')
    .single();
  if (e2) return { error: e2.message };

  const { error: e3 } = await client.from('plans').update({ status: 'awaiting_payment' }).eq('id', plan.id);
  if (e3) return { error: e3.message };

  return { error: null, escrowId: esc.id as string };
}
