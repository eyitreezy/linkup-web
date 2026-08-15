/**
 * Send magic-link invitation email to a non-platform user.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, APP_URL
 */
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const APP_URL = (Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://linkup.app').replace(
  /\/$/,
  ''
);

function buildNewUserInvitationEmail(p: {
  hostName: string;
  planName?: string;
  meetType?: string;
  planDate?: string;
  shareAmount?: string;
  magicLink: string;
}): string {
  return `
    <p>Hi,</p>
    <p><strong>${p.hostName}</strong> has invited you to join
    <strong>${p.planName ?? 'a meetup'}</strong> on LinkUp,
    a verified meetup platform.</p>
    ${p.meetType ? `<p>Meet type: ${p.meetType}</p>` : ''}
    ${p.planDate ? `<p>Date: ${p.planDate}</p>` : ''}
    ${p.shareAmount ? `<p>Your share if you join: <strong>${p.shareAmount}</strong></p>` : ''}
    <p>Create your free LinkUp account to view and respond to this invitation.</p>
    <p>
      <a href="${p.magicLink}"
        style="background:#6C63FF;color:#fff;padding:12px 24px;
        border-radius:50px;text-decoration:none;font-weight:600;">
        Accept invitation
      </a>
    </p>
    <p style="font-size:12px;color:#999;">
      This link expires in 72 hours. If you did not expect this email, you can ignore it.
    </p>
  `;
}

function invitationExpiresAt(planScheduledAt: string | null): Date {
  const now = Date.now();
  const defaultExpiry = now + 72 * 60 * 60 * 1000;
  if (!planScheduledAt) return new Date(defaultExpiry);
  const scheduledMs = new Date(planScheduledAt).getTime();
  if (Number.isNaN(scheduledMs)) return new Date(defaultExpiry);
  const beforeMeetup = scheduledMs - 48 * 60 * 60 * 1000;
  return new Date(Math.min(defaultExpiry, beforeMeetup));
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 405);
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  if (!resendKey || !resendFrom) {
    console.error('[send-plan-invitation-email] Missing RESEND_API_KEY or RESEND_FROM');
    return jsonError('misconfigured', 500);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[send-plan-invitation-email]', e);
    return jsonError('misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('unauthorized', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  const host = authData?.user;
  if (authErr || !host) {
    return jsonError('unauthorized', 401);
  }

  let body: {
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

  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const planId = body.planId?.trim();
  const inviteeEmail = body.inviteeEmail?.trim().toLowerCase();
  if (!planId || !inviteeEmail) {
    return jsonError('planId and inviteeEmail required', 400);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(inviteeEmail)) {
    return jsonError('invalid_email', 400);
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, creator_id, scheduled_at, is_group_plan, group_closed_at, max_guests, accepted_guest_count')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    return jsonError('plan_not_found', 404);
  }

  if (plan.creator_id !== host.id) {
    return jsonError('not_plan_host', 403);
  }

  if (!plan.is_group_plan) {
    return jsonError('invitations_group_only', 400);
  }

  if (plan.group_closed_at) {
    return jsonError('group_already_closed', 400);
  }

  const { data: slots, error: slotsErr } = await supabase.rpc('get_plan_available_slots', {
    p_plan_id: planId,
  });
  if (slotsErr || (typeof slots === 'number' && slots <= 0)) {
    return jsonError('no_slots_available', 400);
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('email', inviteeEmail)
    .maybeSingle();

  if (existingUser?.id) {
    const { data: invId, error: rpcErr } = await supabase.rpc('send_plan_invitation_to_user', {
      p_plan_id: planId,
      p_invitee_user_id: existingUser.id,
    });
    if (rpcErr) {
      console.error('[send-plan-invitation-email] in-app invite', rpcErr.message);
      return jsonError(rpcErr.message, 400);
    }
    return jsonResponse({ invitationId: String(invId) });
  }

  const expiresAt = invitationExpiresAt(plan.scheduled_at ?? null);

  const { data: invitation, error: insertError } = await supabase
    .from('plan_invitations')
    .insert({
      plan_id: planId,
      host_id: host.id,
      invitee_email: inviteeEmail,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, invitation_token')
    .single();

  if (insertError) {
    console.error('[send-plan-invitation-email] insert', insertError.message);
    return jsonError(insertError.message, 400);
  }

  const redirectTo = `${APP_URL}/onboarding?invitation_token=${invitation.invitation_token}`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: inviteeEmail,
    options: { redirectTo },
  });

  if (linkError) {
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    console.error('[send-plan-invitation-email] magic link', linkError.message);
    return jsonError('magic_link_failed', 500);
  }

  const magicLink = linkData.properties?.action_link;
  if (!magicLink) {
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    return jsonError('magic_link_failed', 500);
  }

  const details = body.planDetails ?? {};
  const html = buildNewUserInvitationEmail({
    hostName: details.hostName ?? 'Someone',
    planName: details.name,
    meetType: details.meetType,
    planDate: details.planDate,
    shareAmount: details.shareAmount,
    magicLink,
  });

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [inviteeEmail],
      subject: 'You have been invited to join a meetup on LinkUp',
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error('[send-plan-invitation-email] Resend', emailRes.status, errText);
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    return jsonError('email_failed', 502);
  }

  return jsonResponse({ invitationId: invitation.id });
});
