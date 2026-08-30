/**
 * Initialise Flutterwave virtual account for subscription bank transfer.
 * Activation happens after webhook or sync RPC confirms funding.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { type BillingCycle, type PaidTier, tierPriceCents, tierPriceNgn } from '../_shared/pricing.ts';

type Body = {
  tier?: PaidTier;
  billing_cycle?: BillingCycle;
  refund_account_id?: string | null;
  one_time_refund_bank_code?: string | null;
  one_time_refund_account_number?: string | null;
  one_time_refund_account_name?: string | null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!flwSecret || !supabaseUrl || !anonKey) {
    return jsonError('Server misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return jsonError('Unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const tier = body.tier;
  const billingCycle = body.billing_cycle;
  if (!tier || !['SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
    return jsonError('Valid tier required (SILVER, GOLD, PLATINUM)', 400);
  }
  if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
    return jsonError('Valid billing_cycle required (monthly, annual)', 400);
  }

  const userId = authData.user.id;
  const email = authData.user.email;
  if (!email) {
    return jsonError('User email required for billing', 400);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const amountCents = tierPriceCents(tier, billingCycle);
  const amountNgn = tierPriceNgn(tier, billingCycle);
  const txRef = `linkup_sub_${userId}_${Date.now()}`;
  const orderRef = `linkup-sub-va-${userId}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountNgn,
      is_permanent: false,
      tx_ref: orderRef,
      narration: `LinkUp ${tier} subscription`,
    }),
  });

  const flwData = (await flwRes.json()) as {
    status?: string;
    data?: { account_number?: string; bank_name?: string; flw_ref?: string };
    message?: string;
  };

  if (flwData.status !== 'success' || !flwData.data?.account_number) {
    console.error('[create-subscription-bank-transfer]', flwData.message ?? flwData);
    return jsonError('Could not generate virtual account. Please try again.', 500);
  }

  const bankName = flwData.data.bank_name ?? 'Virtual Bank';
  const bankCode = '035';

  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  const { data: session, error: insertErr } = await supabase
    .from('subscription_bank_transfer_sessions')
    .insert({
      user_id: userId,
      tier,
      billing_cycle: billingCycle,
      amount_cents: amountCents,
      tx_ref: txRef,
      account_number: flwData.data.account_number,
      bank_name: bankName,
      bank_code: bankCode,
      flutterwave_order_ref: orderRef,
      refund_account_id: body.refund_account_id ?? null,
      one_time_refund_bank_code: body.one_time_refund_bank_code ?? null,
      one_time_refund_account_number: body.one_time_refund_account_number ?? null,
      one_time_refund_account_name: body.one_time_refund_account_name ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (insertErr || !session) {
    console.error('[create-subscription-bank-transfer] insert failed', insertErr?.message);
    return jsonError('Failed to store session.', 500);
  }

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'checkout_started',
    from_tier: (userRow?.subscription_tier as string | undefined) ?? 'FREE',
    to_tier: tier,
    billing_cycle: billingCycle,
    amount_ngn: amountNgn,
    flutterwave_reference: txRef,
    metadata: { payment_method: 'bank_transfer', session_id: session.id },
  });

  return jsonResponse({
    session_id: session.id,
    tx_ref: txRef,
    account_number: flwData.data.account_number,
    bank_name: bankName,
    bank_code: bankCode,
    amount_cents: amountCents,
    expires_at: expiresAt,
  });
});
