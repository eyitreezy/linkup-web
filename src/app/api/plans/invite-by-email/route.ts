import { createClient } from '@/lib/supabase/server';
import { ensureSupabaseAccessToken } from '@/lib/supabase/ensureAccessToken';
import { env, isSupabaseConfigured } from '@/lib/env';
import { NextResponse } from 'next/server';

type InviteEmailBody = {
  planId?: string;
  inviteeEmail?: string;
  planDetails?: {
    name?: string;
    hostName?: string;
    meetType?: string;
    planDate?: string;
    shareAmount?: string;
  };
};

function normalizeInviteResponse(body: Record<string, unknown>): Record<string, unknown> {
  const invitationId = body.invitationId ?? body.invitation_id;
  if (typeof invitationId === 'string' && invitationId && !body.invitationId) {
    return { ...body, invitationId };
  }
  return body;
}

/** Proxy email invites through the server session (HttpOnly cookies) — reliable auth for Edge Functions. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  let payload: InviteEmailBody;
  try {
    payload = (await request.json()) as InviteEmailBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await ensureSupabaseAccessToken(supabase);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const functionUrl = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/send-plan-invitation-email`;
  let upstream: Response;
  try {
    upstream = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[invite-by-email] upstream fetch failed', err);
    return NextResponse.json({ error: 'invite_upstream_failed' }, { status: 502 });
  }

  let body: Record<string, unknown> = {};
  const raw = await upstream.text();
  if (raw) {
    try {
      body = normalizeInviteResponse(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      console.error('[invite-by-email] non-json upstream', upstream.status, raw.slice(0, 300));
      body = { error: raw.slice(0, 200) || 'invite_failed' };
    }
  } else {
    console.error('[invite-by-email] empty upstream body', upstream.status);
    body = { error: 'invite_empty_response' };
  }

  if (!upstream.ok) {
    console.error('[invite-by-email] upstream error', upstream.status, body);
  }

  return NextResponse.json(body, { status: upstream.status });
}
