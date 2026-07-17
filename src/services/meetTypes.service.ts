import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { filterMeetTypesVisibleToUser } from '@/lib/plans/meetTypes';
import type { DbMeetType } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchActiveMeetTypes(client: SupabaseClient) {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { rows: [] as DbMeetType[], error: error.message };
  return { rows: (data ?? []) as DbMeetType[], error: null };
}

/** Active catalog types plus the signed-in user's own pending submissions. */
export async function fetchMeetTypesForUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .or(`is_active.eq.true,and(created_by.eq.${userId},approval_status.eq.pending)`)
    .order('sort_order', { ascending: true });

  if (error) return { rows: [] as DbMeetType[], error: error.message };
  return {
    rows: filterMeetTypesVisibleToUser((data ?? []) as DbMeetType[], userId),
    error: null,
  };
}

/**
 * Best-effort Resend email via Supabase Edge Function `send-meet-type-email`.
 * In-app notifications are handled by DB RPCs; this must never block UX.
 * Set NEXT_PUBLIC_MEET_TYPE_EMAIL_ENABLED=true once the function is deployed.
 */
export async function invokeMeetTypeEmail(
  client: SupabaseClient,
  body: Record<string, unknown>
) {
  if (process.env.NEXT_PUBLIC_MEET_TYPE_EMAIL_ENABLED !== 'true') {
    return;
  }

  try {
    const { error } = await client.functions.invoke('send-meet-type-email', { body });
    if (error && process.env.NODE_ENV === 'development') {
      console.debug('[meet-type-email]', error.message);
    }
  } catch {
    // Function not deployed or unreachable — non-fatal.
  }
}

export async function countPlansUsingMeetType(client: SupabaseClient, meetTypeId: string) {
  const { count, error } = await client
    .from('plans')
    .select('id', { count: 'exact', head: true })
    .eq('meet_type_id', meetTypeId);

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function createUserMeetType(
  client: SupabaseClient,
  userId: string,
  input: { name: string; defaultDurationMinutes?: number }
) {
  const trimmed = input.name.trim();
  if (!trimmed) return { row: null as DbMeetType | null, error: 'Enter a name for your meet type.' };
  if (!userId) return { row: null, error: 'Sign in to create a meet type.' };

  const duration = input.defaultDurationMinutes ?? 120;

  const { data, error } = await client.rpc('insert_user_meet_type', {
    p_name: trimmed,
    p_default_duration_minutes: duration,
    p_icon: inferMeetTypeIcon(trimmed),
  });

  if (error) return { row: null, error: error.message };
  return { row: data as DbMeetType, error: null };
}

export async function updateUserMeetType(
  client: SupabaseClient,
  userId: string,
  meetTypeId: string,
  patch: { name?: string; defaultDurationMinutes?: number }
) {
  const updates: Record<string, unknown> = {};
  if (patch.name != null) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { row: null as DbMeetType | null, error: 'Name cannot be empty.' };
    updates.name = trimmed;
    updates.icon = inferMeetTypeIcon(trimmed);
  }
  if (patch.defaultDurationMinutes != null) {
    updates.default_duration_minutes = patch.defaultDurationMinutes;
  }
  if (!Object.keys(updates).length) {
    return { row: null, error: 'Nothing to update.' };
  }

  const { data, error } = await client
    .from('meet_types')
    .update(updates)
    .eq('id', meetTypeId)
    .eq('created_by', userId)
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as DbMeetType, error: null };
}

/** Soft-delete when no plans reference this type. */
export async function deleteUserMeetType(
  client: SupabaseClient,
  userId: string,
  meetTypeId: string
) {
  const { count, error: countErr } = await countPlansUsingMeetType(client, meetTypeId);
  if (countErr) return { error: countErr };
  if (count > 0) {
    return {
      error: `This meet type is used on ${count} plan${count === 1 ? '' : 's'} and cannot be deleted.`,
      blockedByPlans: true as const,
      planCount: count,
    };
  }

  const { error } = await client
    .from('meet_types')
    .update({ is_active: false })
    .eq('id', meetTypeId)
    .eq('created_by', userId);

  if (error) return { error: error.message };
  return { error: null };
}
