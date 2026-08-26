import { resolveEscrowParties } from '@/lib/plans/escrowParties';
import { isSyntheticJoinRequestOffer } from '@/lib/plans/joinRequestOffers';
import { MAX_ESCROW_TIER1_CENTS, MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import { checkPermission } from '@/lib/subscription/checkPermission';
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

/**
 * Paid plan: create pattern-aware escrow via SECURITY DEFINER RPC (RLS-safe).
 */
export async function proceedToSecurePayment(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer
): Promise<AgreementActionResult> {
  if (!plan.is_paid) {
    return { error: 'This plan is free. No escrow step.' };
  }

  const amountCents = Math.round(
    Number(plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0)
  );
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: 'No payment amount for this plan.' };
  }
  if (amountCents < MIN_ESCROW_CENTS) {
    return { error: `Minimum escrow is ₦${MIN_ESCROW_CENTS / 100} per policy.` };
  }

  const pattern = plan.escrow_pattern;
  if (!pattern) return { error: 'Escrow pattern missing on plan.' };

  const { data: authData } = await client.auth.getUser();
  const actorId = authData.user?.id;
  if (!actorId) return { error: 'Not signed in.' };

  if (amountCents > MAX_ESCROW_TIER1_CENTS) {
    const perm = await checkPermission(actorId, 'escrow.high_value');
    if (!perm.allowed) {
      return { error: 'high_value_requires_platinum' };
    }
    const { data: actorUser } = await client.from('users').select('kyc_tier').eq('id', actorId).maybeSingle();
    if (((actorUser?.kyc_tier as number) ?? 1) < 3) {
      return { error: 'high_value_requires_kyc_tier3' };
    }
    if (pattern === 'C') {
      const { data: guestUser } = await client
        .from('users')
        .select('kyc_tier')
        .eq('id', offer.bidder_id)
        .maybeSingle();
      if (((guestUser?.kyc_tier as number) ?? 1) < 3) {
        return { error: 'high_value_counterparty_requires_kyc_tier3' };
      }
    }
  }

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
    amountCents
  );

  const hostId = plan.creator_id;
  const guestId = offer.bidder_id;

  if (isSyntheticJoinRequestOffer(plan)) {
    if (actorId === hostId) {
      const { data: pendingHostEscrow } = await client
        .from('escrow_transactions')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('payer_id', hostId)
        .is('guest_id', null)
        .eq('status', 'pending_funding')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingHostEscrow?.id) {
        return { error: null, escrowId: pendingHostEscrow.id as string };
      }
      if (plan.host_escrow_id) {
        return { error: null, escrowId: plan.host_escrow_id };
      }
      const { data: existingHostEscrow } = await client
        .from('escrow_transactions')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('payer_id', hostId)
        .maybeSingle();
      if (existingHostEscrow?.id) {
        return { error: null, escrowId: existingHostEscrow.id as string };
      }
      return { error: 'close_group_first' };
    }

    const { data: existingGuestEscrow } = await client
      .from('escrow_transactions')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('guest_id', actorId)
      .maybeSingle();
    if (existingGuestEscrow?.id) {
      return { error: null, escrowId: existingGuestEscrow.id as string };
    }
    return { error: 'You are not eligible to start payment for this plan.' };
  }

  // Group split host must use/create host escrow leg, never guest slot escrow.
  if (plan.is_group_plan && pattern === 'B' && actorId === hostId) {
    const { data: pendingHostEscrow } = await client
      .from('escrow_transactions')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('payer_id', hostId)
      .is('guest_id', null)
      .eq('status', 'pending_funding')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingHostEscrow?.id) {
      return { error: null, escrowId: pendingHostEscrow.id as string };
    }
    if (plan.host_escrow_id) {
      return { error: null, escrowId: plan.host_escrow_id };
    }
    const { data: existingHostEscrow } = await client
      .from('escrow_transactions')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('payer_id', hostId)
      .maybeSingle();
    if (existingHostEscrow?.id) {
      return { error: null, escrowId: existingHostEscrow.id as string };
    }
    return { error: 'close_group_first' };
  }

  const { data: existingEscrow } = await client
    .from('escrow_transactions')
    .select('id')
    .eq('plan_id', plan.id)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (existingEscrow?.id) {
    if (plan.status === 'agreed') {
      const { error: statusErr } = await client
        .from('plans')
        .update({ status: 'awaiting_payment' })
        .eq('id', plan.id)
        .eq('status', 'agreed');
      if (statusErr) return { error: statusErr.message };
    }
    return { error: null, escrowId: existingEscrow.id as string };
  }

  if (!plan.is_group_plan) {
    const { data: existingByPlan } = await client
      .from('escrow_transactions')
      .select('id')
      .eq('plan_id', plan.id)
      .maybeSingle();
    if (existingByPlan?.id) {
      return { error: null, escrowId: existingByPlan.id as string };
    }
  }

  const fundingDeadline = plan.is_mood_plan
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let groupPlanIndex: number | null = null;
  if (plan.is_group_plan) {
    const { count } = await client
      .from('escrow_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id);
    groupPlanIndex = (count ?? 0) + 1;
  }

  const metadata = pattern === 'B' ? { legs: 'split', phase: 'awaiting_payment' } : {};

  const { data: escrowId, error: rpcErr } = await client.rpc('create_plan_escrow_transaction', {
    p_plan_id: plan.id,
    p_offer_id: offer.id,
    p_payer_id: payerId,
    p_payee_id: payeeId,
    p_host_id: hostId,
    p_guest_id: guestId,
    p_amount_cents: amountCents,
    p_host_share_cents: hostShareCents,
    p_guest_share_cents: guestShareCents,
    p_escrow_pattern: pattern,
    p_currency: plan.currency ?? 'NGN',
    p_funding_deadline: fundingDeadline,
    p_group_plan_index: groupPlanIndex,
    p_metadata: metadata,
  });

  if (rpcErr) {
    if (rpcErr.message.includes('both_parties_must_confirm')) {
      return { error: 'Both parties must confirm the agreement before payment.' };
    }
    if (rpcErr.message.includes('verification_required')) {
      return { error: 'Identity verification is required before secure payment.' };
    }
    if (rpcErr.message.includes('not_eligible')) {
      return { error: 'You are not eligible to start payment for this plan.' };
    }
    return { error: rpcErr.message };
  }

  if (!escrowId) {
    return { error: 'Could not create escrow for this plan.' };
  }

  return { error: null, escrowId: escrowId as string };
}
