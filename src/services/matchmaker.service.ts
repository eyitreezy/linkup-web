import type { SupabaseClient } from '@supabase/supabase-js';
import type { MatchMakerGateState } from '@/lib/matchmaker/gates';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';
import type {
  MatchMakerInterestQueue,
  MatchMakerInterestQueueRow,
} from '@/types/matchmaker-interests';

export async function fetchMatchMakerGateState(
  client: SupabaseClient
): Promise<{ data: MatchMakerGateState | null; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_get_gate_state');
  if (error) return { data: null, error: error.message };
  return { data: data as MatchMakerGateState, error: null };
}

export type MatchMakerPoolEmptyReason =
  | 'gender_not_set'
  | 'dealbreakers_strict'
  | 'location_narrow'
  | 'genuinely_empty'
  | null;

export type MatchMakerPoolFilter = {
  maxDistanceKm?: number | null;
  sortBy?: 'best_match' | 'recently_joined';
};

export async function fetchMatchMakerPool(
  client: SupabaseClient,
  limit = 12,
  filter?: MatchMakerPoolFilter
): Promise<{
  data: PoolProfileRow[];
  emptyReason: MatchMakerPoolEmptyReason;
  error: string | null;
}> {
  const { data, error } = await client.rpc('matchmaker_get_pool', {
    p_limit: limit,
    p_max_distance_km: filter?.maxDistanceKm ?? null,
    p_sort_by: filter?.sortBy ?? 'best_match',
  });
  if (error) return { data: [], emptyReason: null, error: error.message };

  if (Array.isArray(data)) {
    return { data: data as PoolProfileRow[], emptyReason: null, error: null };
  }

  const envelope = (typeof data === 'string' ? JSON.parse(data) : data) as {
    profiles?: PoolProfileRow[];
    empty_reason?: string | null;
  };

  return {
    data: envelope.profiles ?? [],
    emptyReason: (envelope.empty_reason ?? null) as MatchMakerPoolEmptyReason,
    error: null,
  };
}

export async function fetchMatchMakerPoolPreview(
  client: SupabaseClient,
  limit = 6
): Promise<{ data: PoolProfileRow[]; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_get_pool_preview', { p_limit: limit });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PoolProfileRow[], error: null };
}

export type ExpressMatchMakerInterestResult = {
  matched: boolean;
  connectionId?: string;
  queued?: boolean;
  surfaced?: boolean;
  alreadySent?: boolean;
  error: string | null;
};

export async function expressMatchMakerInterest(
  client: SupabaseClient,
  toUserId: string
): Promise<ExpressMatchMakerInterestResult> {
  const { data, error } = await client.rpc('matchmaker_express_interest', { p_to_user_id: toUserId });
  if (error) return { matched: false, error: error.message };
  const payload = data as {
    matched?: boolean;
    connection_id?: string;
    queued?: boolean;
    surfaced?: boolean;
    already_sent?: boolean;
  };
  return {
    matched: !!payload.matched,
    connectionId: payload.connection_id,
    queued: payload.queued,
    surfaced: payload.surfaced,
    alreadySent: payload.already_sent,
    error: null,
  };
}

export async function fetchMatchMakerInterestQueue(
  client: SupabaseClient
): Promise<{ data: MatchMakerInterestQueue | null; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_get_interest_queue');
  if (error) return { data: null, error: error.message };
  const payload = data as {
    sent?: MatchMakerInterestQueueRow[];
    received?: MatchMakerInterestQueueRow[];
    received_count?: number;
  };
  return {
    data: {
      sent: payload.sent ?? [],
      received: payload.received ?? [],
      receivedCount: payload.received_count ?? 0,
    },
    error: null,
  };
}

export async function passMatchMakerInterest(
  client: SupabaseClient,
  fromUserId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_pass_interest', { p_from_user_id: fromUserId });
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean };
  return { ok: !!payload.ok, error: null };
}

export async function fetchMatchMakerConnection(
  client: SupabaseClient,
  connectionId: string
): Promise<{ data: MatchMakerConnectionRow | null; error: string | null }> {
  const { data, error } = await client
    .from('matchmaker_connections')
    .select(
      'id, user_a_id, user_b_id, status, connected_at, first_message_at, plan_unlock_at, ended_at, first_plan_created_at, paused_at'
    )
    .eq('id', connectionId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as MatchMakerConnectionRow | null, error: null };
}

export async function endMatchMakerConnection(
  client: SupabaseClient,
  connectionId: string,
  reason: string
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('matchmaker_end_connection', {
    p_connection_id: connectionId,
    p_reason: reason,
  });
  return { error: error?.message ?? null };
}

export async function sendReadyToMeetSignal(
  client: SupabaseClient,
  connectionId: string
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('matchmaker_send_ready_signal', {
    p_connection_id: connectionId,
  });
  return { error: error?.message ?? null };
}

export async function recordMatchMakerFirstMessage(
  client: SupabaseClient,
  connectionId: string
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('matchmaker_record_first_message', {
    p_connection_id: connectionId,
  });
  return { error: error?.message ?? null };
}

export async function saveMatchMakerIntent(
  client: SupabaseClient,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await client.from('matchmaker_intents').upsert({
    user_id: userId,
    declared_at: new Date().toISOString(),
    is_active: true,
    last_reaffirmed_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

export type MatchMakerValuesInput = {
  faith: string | null;
  family_goals: string;
  pace_preference: string;
  communication_frequency: string | null;
  dealbreakers: Record<string, unknown>;
};

export async function saveMatchMakerValues(
  client: SupabaseClient,
  userId: string,
  values: MatchMakerValuesInput
): Promise<{ error: string | null }> {
  const { error } = await client.from('matchmaker_values').upsert({
    user_id: userId,
    ...values,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

export async function hasReadySignal(
  client: SupabaseClient,
  connectionId: string,
  userId: string
): Promise<boolean> {
  const { data } = await client
    .from('matchmaker_ready_signals')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('signalling_user_id', userId)
    .maybeSingle();
  return !!data;
}
