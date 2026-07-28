import { createClient } from '@/lib/supabase/client';

const GROUP_POLICY_VERSION = 'v1.0';
const ESCROW_POLICY_VERSION = 'v1.0';

function functionsBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Supabase URL not configured');
  return `${url}/functions/v1`;
}

async function authHeader(): Promise<Record<string, string>> {
  const client = createClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function submitArrivalNudge(planId: string): Promise<{
  nudged_at?: string;
  already_nudged?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/submit-arrival-nudge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader()),
      },
      body: JSON.stringify({ plan_id: planId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Could not send arrival nudge' };
    return data;
  } catch {
    return { error: 'Could not send arrival nudge' };
  }
}

export async function submitDisputeVideo(formData: FormData): Promise<{
  dispute_id?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/submit-dispute-video`, {
      method: 'POST',
      headers: await authHeader(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Video submission failed' };
    return data;
  } catch {
    return { error: 'Video submission failed' };
  }
}

export async function submitExigencyReport(formData: FormData): Promise<{
  report_id?: string;
  review_hours?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/submit-exigency-report`, {
      method: 'POST',
      headers: await authHeader(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Could not submit report' };
    return data;
  } catch {
    return { error: 'Could not submit report' };
  }
}

export async function confirmGroupMeetupHost(planId: string): Promise<{ ok: boolean; error?: string }> {
  const client = createClient();
  const { error } = await client.rpc('submit_group_meetup_confirmation', { p_plan_id: planId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function confirmGroupGuestAttendance(planId: string): Promise<{ ok: boolean; error?: string }> {
  const client = createClient();
  const { error } = await client.rpc('submit_group_guest_confirmation', { p_plan_id: planId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function hasGroupPolicySignoff(): Promise<boolean> {
  const client = createClient();
  const { data } = await client
    .from('group_plan_policy_signoffs')
    .select('id')
    .eq('policy_version', GROUP_POLICY_VERSION)
    .maybeSingle();
  return !!data;
}

export async function signGroupPolicySignoff(deviceFingerprint?: string): Promise<{ ok: boolean; error?: string }> {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const { error } = await client.from('group_plan_policy_signoffs').insert({
    user_id: user.id,
    policy_version: GROUP_POLICY_VERSION,
    device_fingerprint: deviceFingerprint ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function hasEscrowPolicySignoff(planId: string): Promise<boolean> {
  const client = createClient();
  const { data } = await client
    .from('escrow_policy_signoffs')
    .select('id')
    .eq('plan_id', planId)
    .eq('policy_version', ESCROW_POLICY_VERSION)
    .maybeSingle();
  return !!data;
}

export async function signEscrowPolicy(planId: string): Promise<{ ok: boolean; error?: string }> {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const { error } = await client.from('escrow_policy_signoffs').insert({
    plan_id: planId,
    user_id: user.id,
    policy_version: ESCROW_POLICY_VERSION,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function hasSafetyCaveatAck(planId: string): Promise<boolean> {
  const client = createClient();
  const { data } = await client
    .from('safety_caveat_acknowledgements')
    .select('id')
    .eq('plan_id', planId)
    .maybeSingle();
  return !!data;
}

/** True when these two users have never completed a plan together. */
export async function isFirstMeetupPair(userId: string, counterpartyId: string): Promise<boolean> {
  const client = createClient();
  const { data: hostSide } = await client
    .from('plan_offers')
    .select('plan_id, plans!inner(id, status, creator_id)')
    .eq('bidder_id', counterpartyId)
    .eq('status', 'accepted')
    .eq('plans.creator_id', userId)
    .eq('plans.status', 'completed')
    .limit(1);
  if (hostSide?.length) return false;

  const { data: guestSide } = await client
    .from('plan_offers')
    .select('plan_id, plans!inner(id, status, creator_id)')
    .eq('bidder_id', userId)
    .eq('status', 'accepted')
    .eq('plans.creator_id', counterpartyId)
    .eq('plans.status', 'completed')
    .limit(1);
  return !(guestSide?.length);
}

export async function needsSafetyCaveatGate(
  planId: string,
  userId: string,
  counterpartyId: string | null | undefined
): Promise<boolean> {
  if (!counterpartyId) return false;
  if (await hasSafetyCaveatAck(planId)) return false;
  return isFirstMeetupPair(userId, counterpartyId);
}

export async function acknowledgeSafetyCaveat(planId: string): Promise<{ ok: boolean; error?: string }> {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const { error } = await client.from('safety_caveat_acknowledgements').insert({
    plan_id: planId,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function isArrivalWindowActive(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime() - 30 * 60 * 1000;
  const end = new Date(scheduledAt).getTime() + 4 * 60 * 60 * 1000;
  const now = Date.now();
  return now >= start && now <= end;
}

export function canReportNoShow(partnerNudgedAt: string | null | undefined, myNudgedAt: string | null | undefined): boolean {
  if (!partnerNudgedAt || myNudgedAt) return false;
  return Date.now() > new Date(partnerNudgedAt).getTime() + 60 * 60 * 1000;
}

export { GROUP_POLICY_VERSION, ESCROW_POLICY_VERSION };
