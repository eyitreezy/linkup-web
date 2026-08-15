import { readEdgeFunctionErrorBody } from '@/lib/supabase/readEdgeFunctionError';
import { edgeFunctionAuthHeaders, ensureSupabaseAccessToken } from '@/lib/supabase/ensureAccessToken';
import {
  mapInviteClientError,
  type InviteClientErrorCode,
} from '@/lib/plans/inviteErrorMessages';
import { createClient } from '@/lib/supabase/client';
import type { InvitationStatus } from '@/types/database';

export type InvitationSearchResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_kyc_verified: boolean;
  already_invited: boolean;
  already_member: boolean;
  gender: string | null;
};

export type PlanInvitationRow = {
  id: string;
  plan_id: string;
  host_id: string;
  invitee_user_id: string | null;
  invitee_email: string | null;
  status: InvitationStatus;
  slot_held: boolean;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  decline_reason?: string | null;
  decline_reason_other?: string | null;
  invitee?: {
    display_name: string | null;
    avatar_url: string | null;
    primary_photo_url?: string | null;
    photo_urls?: string[] | null;
  } | null;
};

export type PlanInviteDetails = {
  name: string;
  hostName: string;
  meetType?: string;
  planDate?: string;
  planLocation?: string;
  shareAmountCents?: number;
};

function rpcErrorCode(error: { message?: string; details?: string }): string {
  return (error.message ?? error.details ?? '').toLowerCase();
}

/** Map Supabase invitation RPC errors to stable client error codes. */
export function mapInvitationRpcError(error: { message?: string; details?: string }): string {
  const msg = error.message ?? '';
  const code = rpcErrorCode(error);
  if (code.includes('not_authenticated')) return 'NOT_AUTHENTICATED';
  if (code.includes('not_invitee')) return 'NOT_INVITEE';
  if (code.includes('invitation_not_found') || code.includes('plan_not_found')) return 'NOT_FOUND';
  if (code.includes('plan_cancelled')) return 'PLAN_CANCELLED';
  if (code.includes('kyc_required') || msg.includes('KYC') || msg.includes('verif')) return 'KYC_REQUIRED';
  if (code.includes('invitation_expired') || code.includes('expired')) return 'EXPIRED';
  if (code.includes('no_slots_available') || code.includes('full') || code.includes('no slot')) {
    return 'PLAN_FULL';
  }
  if (code.includes('invitation_already_declined')) return 'ALREADY_DECLINED';
  if (code.includes('invitation_cancelled')) return 'INVITATION_CANCELLED';
  if (code.includes('invitation_not_pending') || code.includes('already')) return 'ALREADY_RESPONDED';
  if (code.includes('join_request_not_applicable')) return 'INVALID_SLOT_AMOUNT';
  if (code.includes('pgrst202') || code.includes('could not find the function')) return 'RPC_NOT_DEPLOYED';
  if (code.includes('invalid_action')) return 'INVALID_ACTION';
  return msg || 'UNKNOWN_ERROR';
}

function mapEmailInviteError(raw: string): InviteClientErrorCode {
  return mapInviteClientError(raw);
}

function mapUserInviteRpcError(error: { message?: string; details?: string }): InviteClientErrorCode {
  const code = rpcErrorCode(error);
  if (code.includes('no_slots_available')) return 'NO_SLOTS';
  if (code.includes('invitation_already_exists')) return 'ALREADY_INVITED';
  if (code.includes('plan_listing_expired') || code.includes('plan_expired')) return 'PLAN_EXPIRED';
  return mapInviteClientError(code);
}

export async function claimPlanInvitationForUser(invitationId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('claim_plan_invitation_for_user', {
    p_invitation_id: invitationId,
  });
  if (error) {
    const mapped = mapInvitationRpcError(error);
    if (mapped === 'NOT_INVITEE') throw new Error('NOT_INVITEE');
    throw error;
  }
  const row = data as { claimed?: boolean };
  return Boolean(row?.claimed);
}

export async function getPlanAvailableSlots(planId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_plan_available_slots', {
    p_plan_id: planId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function sendInvitationToUser(
  planId: string,
  inviteeUserId: string,
  _planDetails?: PlanInviteDetails
): Promise<{ invitationId: string; delivery?: 'email' | 'in_app' }> {
  const supabase = createClient();
  await ensureSupabaseAccessToken(supabase);

  const { data, error } = await supabase.rpc('send_plan_invitation_to_user', {
    p_plan_id: planId,
    p_invitee_user_id: inviteeUserId,
  });

  if (error) {
    throw new Error(mapUserInviteRpcError(error));
  }

  return { invitationId: data as string };
}

export async function sendInvitationByEmail(
  planId: string,
  inviteeEmail: string,
  planDetails: PlanInviteDetails
): Promise<{ invitationId: string; delivery?: 'email' | 'in_app' }> {
  const supabase = createClient();
  const normalizedEmail = inviteeEmail.trim().toLowerCase();
  const authHeaders = await edgeFunctionAuthHeaders(supabase);

  const shareLabel = planDetails.shareAmountCents
    ? formatInviteShare(planDetails.shareAmountCents, 'NGN')
    : undefined;

  const { data, error } = await supabase.functions.invoke('send-plan-invitation-email', {
    headers: authHeaders,
    body: {
      planId,
      inviteeEmail: normalizedEmail,
      planDetails: {
        name: planDetails.name,
        hostName: planDetails.hostName,
        meetType: planDetails.meetType,
        planDate: planDetails.planDate,
        shareAmount: shareLabel,
      },
    },
  });

  if (error) {
    console.error('[sendInvitationByEmail] invoke', error);
    const body = await readEdgeFunctionErrorBody(error);
    if (body?.error) throw new Error(mapEmailInviteError(String(body.error)));
    throw new Error(mapEmailInviteError(error.message ?? 'INVITE_FAILED'));
  }
  const payload = data as { invitationId?: string; error?: string; delivery?: 'email' | 'in_app' } | null;
  if (payload?.error) throw new Error(mapEmailInviteError(payload.error));
  if (!payload?.invitationId) throw new Error('INVITE_FAILED');
  return { invitationId: payload.invitationId, delivery: payload.delivery ?? 'email' };
}

export async function respondToInvitation(
  invitationId: string,
  action: 'accept' | 'decline',
  declineReason?: string | null,
  declineReasonOther?: string | null
): Promise<{
  action: string;
  isNegotiable: boolean;
  offerId?: string;
  escrowId?: string;
  slotAmountCents?: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('respond_to_plan_invitation', {
    p_invitation_id: invitationId,
    p_action: action,
    p_decline_reason: declineReason ?? null,
    p_decline_reason_other: declineReasonOther ?? null,
  });

  if (error) {
    const mapped = mapInvitationRpcError(error);
    console.error('[respondToInvitation]', error);
    throw new Error(mapped);
  }

  return data as {
    action: string;
    isNegotiable: boolean;
    offerId?: string;
    escrowId?: string;
    slotAmountCents?: number;
  };
}

export async function searchUsersForInvitation(
  query: string,
  planId: string
): Promise<InvitationSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('search_users_for_invitation', {
    p_query: query,
    p_plan_id: planId,
  });
  if (error) throw error;
  return ((data ?? []) as InvitationSearchResult[]).map((row) => ({
    ...row,
    already_member: row.already_member ?? false,
    gender: row.gender ?? null,
  }));
}

export async function fetchPlanInvitations(planId: string): Promise<PlanInvitationRow[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from('plan_invitations')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const list = (rows ?? []) as PlanInvitationRow[];
  if (list.length === 0) return [];

  const userIds = [
    ...new Set(list.map((r) => r.invitee_user_id).filter((id): id is string => Boolean(id))),
  ];
  if (userIds.length === 0) return list;

  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, primary_photo_url, photo_urls')
    .in('user_id', userIds);

  const byId = new Map(
    (profs ?? []).map((p) => [
      p.user_id,
      {
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        primary_photo_url: p.primary_photo_url,
        photo_urls: p.photo_urls,
      },
    ])
  );

  return list.map((row) => ({
    ...row,
    invitee: row.invitee_user_id ? byId.get(row.invitee_user_id) ?? null : null,
  }));
}

export async function fetchMyInvitation(
  invitationId: string
): Promise<PlanInvitationRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plan_invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlanInvitationRow) ?? null;
}

export async function countPendingInvitations(planId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('plan_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('plan_invitations')
    .update({ status: 'cancelled', slot_held: false })
    .eq('id', invitationId)
    .eq('status', 'pending');
  if (error) throw error;
}

export async function linkInvitationAfterSignup(token: string): Promise<{
  linked: boolean;
  planId?: string;
  invitationId?: string;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('link_invitation_after_signup', {
    p_token: token,
  });
  if (error) throw error;
  const row = data as { linked?: boolean; planId?: string; invitationId?: string };
  return {
    linked: Boolean(row?.linked),
    planId: row?.planId,
    invitationId: row?.invitationId,
  };
}

function formatInviteShare(cents: number, currency: string): string {
  const major = cents / 100;
  if (currency === 'NGN') {
    return `₦${major.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${major.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
