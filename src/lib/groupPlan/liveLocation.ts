import { createClient } from '@/lib/supabase/client';

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

export async function startLiveLocation(
  planId: string,
  durationMinutes: number
): Promise<{ session_id?: string; expires_at?: string; error?: string }> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/start-live-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ plan_id: planId, duration_minutes: durationMinutes }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Could not start location sharing' };
    return data;
  } catch {
    return { error: 'Could not start location sharing' };
  }
}

export async function stopLiveLocation(sessionId: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/stop-live-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error ?? 'Could not stop sharing' };
    }
    return {};
  } catch {
    return { error: 'Could not stop sharing' };
  }
}

export async function pingLiveLocation(payload: {
  session_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<void> {
  try {
    await fetch(`${functionsBaseUrl()}/ping-live-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort ping
  }
}

export async function submitGuestOptOut(planId: string): Promise<{
  opted_out?: boolean;
  triggered_minimum_cancel?: boolean;
  new_member_count?: number;
  error?: string;
}> {
  const client = createClient();
  const { data, error } = await client.rpc('submit_guest_opt_out', { p_plan_id: planId });
  if (error) return { error: error.message };
  return data as {
    opted_out?: boolean;
    triggered_minimum_cancel?: boolean;
    new_member_count?: number;
  };
}

export async function submitHostMinimumAction(
  planId: string,
  action: 'extend_registration' | 'proceed_smaller' | 'cancel'
): Promise<{ error?: string; cancelled?: boolean }> {
  const client = createClient();
  const { data, error } = await client.rpc('submit_host_minimum_action', {
    p_plan_id: planId,
    p_action: action,
  });
  if (error) return { error: error.message };
  return data as { cancelled?: boolean };
}

export async function submitGroupHostCancellation(payload: {
  plan_id: string;
  reason_type: string;
  reason_text?: string;
}): Promise<{ error?: string; cancelled?: boolean }> {
  try {
    const res = await fetch(`${functionsBaseUrl()}/submit-group-host-cancellation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Cancellation failed' };
    return data;
  } catch {
    return { error: 'Cancellation failed' };
  }
}

export async function submitChatLogConsent(
  disputeId: string,
  consented: boolean
): Promise<{ error?: string }> {
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'Not signed in' };
  const { error } = await client.from('dispute_chat_log_consents').insert({
    dispute_id: disputeId,
    user_id: user.id,
    consented,
  });
  if (error) return { error: error.message };
  return {};
}

export type CancellationTerms = {
  timing_band: string;
  hours_until_meetup: number;
  canceller_refund_percent: number;
  other_party_penalty_percent: number;
  other_party_goodwill_credit: string;
  trust_strikes: number;
  visibility_reduction_percent: number;
  visibility_reduction_days: number;
  creation_hold_days: number;
  requires_admin_review: boolean;
};

export async function fetchGuestOptOutTerms(planId: string): Promise<{
  terms?: CancellationTerms;
  error?: string;
}> {
  const client = createClient();
  const { data, error } = await client.rpc('get_cancellation_terms', {
    p_plan_id: planId,
    p_cancelling_party: 'guest',
    p_no_show: false,
  });
  if (error) return { error: error.message };
  return { terms: data as CancellationTerms };
}

export async function fetchCancellationTerms(planId: string): Promise<{
  terms?: CancellationTerms;
  error?: string;
}> {
  const client = createClient();
  const { data, error } = await client.rpc('get_cancellation_terms', {
    p_plan_id: planId,
    p_cancelling_party: 'host',
    p_no_show: false,
  });
  if (error) return { error: error.message };
  return { terms: data as CancellationTerms };
}
