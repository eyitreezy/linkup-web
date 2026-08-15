import { createClient } from '@/lib/supabase/server';
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

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const functionUrl = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/send-plan-invitation-email`;
  const upstream = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body: Record<string, unknown> = {};
  const raw = await upstream.text();
  if (raw) {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = { error: raw.slice(0, 200) || 'invite_failed' };
    }
  }

  return NextResponse.json(body, { status: upstream.status });
}
