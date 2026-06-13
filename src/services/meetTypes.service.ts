import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import type { DbMeetType } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'meetup';
}

export async function fetchActiveMeetTypes(client: SupabaseClient) {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { rows: [] as DbMeetType[], error: error.message };
  return { rows: (data ?? []) as DbMeetType[], error: null };
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

  const base = slugBase(trimmed);
  const entropy = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `u-${base}-${entropy}`;
  const duration = input.defaultDurationMinutes ?? 120;

  const { data, error } = await client
    .from('meet_types')
    .insert({
      name: trimmed,
      slug,
      default_duration_minutes: duration,
      allows_escrow: true,
      allowed_patterns: ['A', 'B', 'C'],
      default_pattern: 'A',
      is_restricted: false,
      supports_mood: false,
      icon: inferMeetTypeIcon(trimmed),
      sort_order: 9000,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single();

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
