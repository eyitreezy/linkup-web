import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { countPlansUsingMeetType, invokeMeetTypeEmail } from '@/services/meetTypes.service';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'meetup';
}

export function adminMeetTypeSlug(name: string): string {
  const base = slugBase(name);
  return `a-${base}-${Date.now().toString(36).slice(2, 8)}`;
}

export type AdminMeetTypeInput = {
  name: string;
  slug?: string;
  description?: string | null;
  meetTypeImages?: string | null;
  defaultDurationMinutes: number;
  isActive: boolean;
  supportsMood: boolean;
  isRestricted: boolean;
};

async function resolveNextMeetTypeSortOrder(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from('meet_types')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const max = (data?.sort_order as number | undefined) ?? 0;
  return max + 10;
}

export async function fetchAllMeetTypesAdmin(client: SupabaseClient) {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { rows: [] as DbMeetType[], error: error.message };
  return { rows: (data ?? []) as DbMeetType[], error: null };
}

export async function createAdminMeetType(client: SupabaseClient, input: AdminMeetTypeInput) {
  const trimmed = input.name.trim();
  if (!trimmed) return { row: null as DbMeetType | null, error: 'Name is required.' };

  const slug = (input.slug?.trim() || adminMeetTypeSlug(trimmed)).toLowerCase();
  const sortOrder = await resolveNextMeetTypeSortOrder(client);

  const { data, error } = await client
    .from('meet_types')
    .insert({
      name: trimmed,
      slug,
      description: input.description?.trim() || null,
      meet_type_images: input.meetTypeImages?.trim() || null,
      default_duration_minutes: input.defaultDurationMinutes,
      allows_escrow: true,
      allowed_patterns: ['A', 'B', 'C'],
      default_pattern: 'A' as EscrowPattern,
      is_restricted: input.isRestricted,
      supports_mood: input.supportsMood,
      icon: inferMeetTypeIcon(trimmed),
      sort_order: sortOrder,
      is_active: input.isActive,
      is_admin_managed: true,
      created_by: null,
    })
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as DbMeetType, error: null };
}

export async function updateAdminMeetType(
  client: SupabaseClient,
  meetTypeId: string,
  input: AdminMeetTypeInput
) {
  const trimmed = input.name.trim();
  if (!trimmed) return { row: null as DbMeetType | null, error: 'Name is required.' };

  const updates: Record<string, unknown> = {
    name: trimmed,
    description: input.description?.trim() || null,
    meet_type_images: input.meetTypeImages?.trim() || null,
    default_duration_minutes: input.defaultDurationMinutes,
    icon: inferMeetTypeIcon(trimmed),
    is_active: input.isActive,
    supports_mood: input.supportsMood,
    is_restricted: input.isRestricted,
  };

  if (input.slug?.trim()) {
    updates.slug = input.slug.trim().toLowerCase();
  }

  const { data, error } = await client
    .from('meet_types')
    .update(updates)
    .eq('id', meetTypeId)
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as DbMeetType, error: null };
}

export async function deleteAdminMeetType(client: SupabaseClient, meetTypeId: string) {
  const { count, error: countErr } = await countPlansUsingMeetType(client, meetTypeId);
  if (countErr) return { error: countErr, blockedByPlans: false as const };
  if (count > 0) {
    return {
      error: `Used on ${count} plan${count === 1 ? '' : 's'} — archive instead of deleting.`,
      blockedByPlans: true as const,
      planCount: count,
    };
  }

  const { error } = await client.from('meet_types').delete().eq('id', meetTypeId);
  if (error) return { error: error.message, blockedByPlans: false as const };
  return { error: null, blockedByPlans: false as const };
}

export async function setAdminMeetTypeActive(
  client: SupabaseClient,
  meetTypeId: string,
  isActive: boolean
) {
  const { data, error } = await client
    .from('meet_types')
    .update({ is_active: isActive })
    .eq('id', meetTypeId)
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as DbMeetType, error: null };
}

export async function adminApproveMeetType(client: SupabaseClient, type: DbMeetType) {
  if (!type.created_by) {
    return { error: 'Only user-created meet types can be approved.' };
  }

  const { error: updateErr } = await client
    .from('meet_types')
    .update({ is_active: true, approval_status: 'approved' })
    .eq('id', type.id);

  if (updateErr) return { error: updateErr.message };

  const { error: notifyErr } = await client.rpc('notify_user_meet_type_approved', {
    p_meet_type_id: type.id,
    p_meet_type_name: type.name,
    p_user_id: type.created_by,
  });
  if (notifyErr && process.env.NODE_ENV === 'development') {
    console.warn('[adminApproveMeetType] notify:', notifyErr.message);
  }

  void invokeMeetTypeEmail(client, {
    type: 'meet_type_approved',
    meetTypeId: type.id,
    meetTypeName: type.name,
    recipientUserId: type.created_by,
  });

  return { error: null };
}

export async function adminRejectMeetType(
  client: SupabaseClient,
  type: DbMeetType,
  reason: string | null
) {
  if (!type.created_by) {
    return { error: 'Only user-created meet types can be rejected.' };
  }

  const { error: updateErr } = await client
    .from('meet_types')
    .update({ is_active: false, approval_status: 'rejected' })
    .eq('id', type.id);

  if (updateErr) return { error: updateErr.message };

  const { error: notifyErr } = await client.rpc('notify_user_meet_type_rejected', {
    p_meet_type_id: type.id,
    p_meet_type_name: type.name,
    p_user_id: type.created_by,
    p_reason: reason || null,
  });
  if (notifyErr && process.env.NODE_ENV === 'development') {
    console.warn('[adminRejectMeetType] notify:', notifyErr.message);
  }

  void invokeMeetTypeEmail(client, {
    type: 'meet_type_rejected',
    meetTypeId: type.id,
    meetTypeName: type.name,
    recipientUserId: type.created_by,
    rejectionReason: reason || null,
  });

  return { error: null };
}

export function meetTypeOriginLabel(type: DbMeetType): string {
  if (type.is_admin_managed) return 'Admin catalog';
  if (type.created_by) return 'User custom';
  return 'Legacy catalog';
}

export function isUserCreatedMeetType(type: DbMeetType): boolean {
  return !!type.created_by && !type.is_admin_managed;
}

export function isAdminCatalogMeetType(type: DbMeetType): boolean {
  return !isUserCreatedMeetType(type);
}

export async function fetchMeetTypeCreatorLabels(
  client: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (!userIds.length) return {};

  const uniqueIds = [...new Set(userIds)];
  const [profilesRes, usersRes] = await Promise.all([
    client.from('profiles').select('user_id, display_name').in('user_id', uniqueIds),
    client.from('users').select('id, email').in('id', uniqueIds),
  ]);

  const emailById = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, (u.email as string | null) ?? null])
  );

  const labels: Record<string, string> = {};
  for (const id of uniqueIds) {
    const profile = (profilesRes.data ?? []).find((p) => p.user_id === id);
    const displayName = (profile?.display_name as string | null)?.trim();
    const email = emailById.get(id)?.trim();
    labels[id] = displayName || email || 'Unknown member';
  }
  return labels;
}
