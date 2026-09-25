import type { SupabaseClient } from '@supabase/supabase-js';
import type { MatchMakerGateState } from '@/lib/matchmaker/gates';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { parseMemberInteractionPayload } from '@/lib/matchmaker/interaction';
import type {
  MatchMakerInterestQueue,
  MatchMakerInterestQueueRow,
} from '@/types/matchmaker-interests';
import type { MatchMakerMemberInteraction } from '@/types/matchmaker-interaction';

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
  interestStatus?: string;
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
    interest_status?: string;
  };
  return {
    matched: !!payload.matched,
    connectionId: payload.connection_id,
    queued: payload.queued,
    surfaced: payload.surfaced,
    alreadySent: payload.already_sent,
    interestStatus: payload.interest_status,
    error: null,
  };
}

export async function passMatchMakerPoolProfile(
  client: SupabaseClient,
  toUserId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_pass_pool_profile', { p_to_user_id: toUserId });
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean };
  return { ok: !!payload.ok, error: null };
}

export async function fetchMatchMakerMemberInteraction(
  client: SupabaseClient,
  memberUserId: string
): Promise<{ data: MatchMakerMemberInteraction | null; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_get_member_interaction', {
    p_member_user_id: memberUserId,
  });
  if (error) return { data: null, error: error.message };
  return { data: parseMemberInteractionPayload(data), error: null };
}

type InterestQueueRpcPayload = {
  sent?: MatchMakerInterestQueueRow[] | null;
  received?: MatchMakerInterestQueueRow[] | null;
  received_count?: number;
  received_unopened_count?: number;
};

function parseInterestQueuePayload(payload: InterestQueueRpcPayload): MatchMakerInterestQueue {
  const received = payload.received ?? [];
  const receivedUnopened =
    payload.received_unopened_count ??
    received.filter((row) => !row.opened_at).length;
  return {
    sent: payload.sent ?? [],
    received,
    receivedCount: payload.received_count ?? received.length,
    receivedUnopenedCount: receivedUnopened,
  };
}

type RawInterestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  expressed_at: string;
  expires_at: string;
  opened_at?: string | null;
  surfaced_at?: string | null;
};

async function fetchMatchMakerInterestQueueFallback(
  client: SupabaseClient,
  userId: string
): Promise<{ data: MatchMakerInterestQueue | null; error: string | null }> {
  const now = new Date().toISOString();

  const [sentRes, receivedRes] = await Promise.all([
    client
      .from('matchmaker_interests')
      .select('id, to_user_id, status, expressed_at, expires_at, opened_at')
      .eq('from_user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('expressed_at', { ascending: false }),
    client
      .from('matchmaker_interests')
      .select('id, from_user_id, status, expressed_at, expires_at, opened_at, surfaced_at')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('expressed_at', { ascending: false }),
  ]);

  if (sentRes.error || receivedRes.error) {
    return {
      data: null,
      error: sentRes.error?.message ?? receivedRes.error?.message ?? 'Failed to load interest queue',
    };
  }

  const sentRaw = (sentRes.data ?? []) as RawInterestRow[];
  const receivedRaw = ((receivedRes.data ?? []) as RawInterestRow[]).filter(
    (row) => row.surfaced_at != null
  );

  const profileIds = [
    ...new Set([
      ...sentRaw.map((r) => r.to_user_id),
      ...receivedRaw.map((r) => r.from_user_id),
    ]),
  ];

  if (profileIds.length === 0) {
    return {
      data: {
        sent: [],
        received: [],
        receivedCount: 0,
        receivedUnopenedCount: 0,
      },
      error: null,
    };
  }

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select(
      'user_id, display_name, birth_date, location_label, photo_urls, primary_photo_url, avatar_url, preferences, communication_style, verified_badge'
    )
    .in('user_id', profileIds);

  if (profileError) {
    return { data: null, error: profileError.message };
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  function toQueueRow(
    interest: RawInterestRow,
    otherUserId: string
  ): MatchMakerInterestQueueRow | null {
    const profile = profileById.get(otherUserId);
    if (!profile) return null;
    return {
      interest_id: interest.id,
      user_id: otherUserId,
      status: interest.status as MatchMakerInterestQueueRow['status'],
      expressed_at: interest.expressed_at,
      expires_at: interest.expires_at,
      opened_at: interest.opened_at ?? null,
      display_name: profile.display_name,
      birth_date: profile.birth_date,
      location_label: profile.location_label,
      photo_urls: profile.photo_urls,
      primary_photo_url: profile.primary_photo_url,
      avatar_url: profile.avatar_url,
      preferences: profile.preferences,
      communication_style: profile.communication_style,
      verified_badge: profile.verified_badge,
    };
  }

  const sent = sentRaw
    .map((row) => toQueueRow(row, row.to_user_id))
    .filter((row): row is MatchMakerInterestQueueRow => row != null);
  const received = receivedRaw
    .map((row) => toQueueRow(row, row.from_user_id))
    .filter((row): row is MatchMakerInterestQueueRow => row != null);

  return {
    data: {
      sent,
      received,
      receivedCount: received.length,
      receivedUnopenedCount: received.filter((row) => !row.opened_at).length,
    },
    error: null,
  };
}

export async function fetchMatchMakerInterestQueue(
  client: SupabaseClient,
  userId?: string
): Promise<{ data: MatchMakerInterestQueue | null; error: string | null }> {
  const { data, error } = await client.rpc('matchmaker_get_interest_queue');

  if (!error && data != null) {
    const payload = (typeof data === 'string' ? JSON.parse(data) : data) as InterestQueueRpcPayload;
    return { data: parseInterestQueuePayload(payload), error: null };
  }

  if (userId) {
    const fallback = await fetchMatchMakerInterestQueueFallback(client, userId);
    if (fallback.data) return fallback;
  }

  return { data: null, error: error?.message ?? 'Failed to load interest queue' };
}

export async function markMatchMakerInterestsOpened(
  client: SupabaseClient
): Promise<{ error: string | null }> {
  const { error } = await client.rpc('matchmaker_mark_interests_opened');
  return { error: error?.message ?? null };
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
