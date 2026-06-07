import type { SupabaseClient } from '@supabase/supabase-js';

/** Wallet ledger + goodwill — server-owned balances; never compute client-side. */
export async function fetchWalletLedger(client: SupabaseClient, userId: string) {
  return client
    .from('wallet_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
}

export async function fetchGoodwillCredits(client: SupabaseClient, userId: string) {
  return client
    .from('goodwill_credits')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });
}

export async function fetchEscrowForUser(client: SupabaseClient, userId: string) {
  return client
    .from('escrow_transactions')
    .select('*, plan:plans(id, title, status)')
    .or(`payer_id.eq.${userId},payee_id.eq.${userId},host_id.eq.${userId},guest_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20);
}
