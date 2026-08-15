/**
 * Resend emails for meet type submission / approval / rejection.
 *
 * Invoked from web (and mobile) after DB notification RPCs.
 *
 * Secrets (Supabase Dashboard → Edge Functions):
 *   RESEND_API_KEY, RESEND_FROM (same as notification-email, e.g. LinkUp <noreply@flowdecklabs.com>)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getResendConfig, sendResendEmail, withLinkUpTextFooter } from '../_shared/resend.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type EmailType = 'meet_type_submitted' | 'meet_type_approved' | 'meet_type_rejected';

type Body = {
  type?: EmailType;
  meetTypeId?: string;
  meetTypeName?: string;
  creatorId?: string;
  recipientUserId?: string;
  rejectionReason?: string | null;
};

function emailContent(
  type: EmailType,
  meetTypeName: string,
  rejectionReason?: string | null
): { subject: string; text: string } {
  if (type === 'meet_type_submitted') {
    return {
      subject: 'LinkUp — meet type pending approval',
      text: `A member submitted "${meetTypeName}" for review. Open the Admin panel to approve or reject it.`,
    };
  }
  if (type === 'meet_type_approved') {
    return {
      subject: 'LinkUp — meet type approved',
      text: `Your custom meet type "${meetTypeName}" was approved and is ready to use when you create a plan.`,
    };
  }
  const reason =
    rejectionReason && rejectionReason.trim()
      ? ` Reason: ${rejectionReason.trim()}`
      : '';
  return {
    subject: 'LinkUp — meet type not approved',
    text: `Your custom meet type "${meetTypeName}" was not approved.${reason} You can submit a new type or pick from the catalog.`,
  };
}

async function resolveUserEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<string | null> {
  const { data: user } = await admin.from('users').select('email').eq('id', userId).maybeSingle();
  let email = user?.email?.trim() || null;
  if (!email) {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    email = authData?.user?.email?.trim() || null;
  }
  return email;
}

async function isAdminUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<boolean> {
  const { data } = await admin.from('admins').select('id').eq('user_id', userId).maybeSingle();
  return !!data;
}

async function sendTransactionalEmail(
  to: string[],
  subject: string,
  text: string
): Promise<Response | null> {
  if (!getResendConfig()) {
    console.error('Missing RESEND_API_KEY or RESEND_FROM');
    return jsonError('Email not configured', 503, 'resend_not_configured');
  }

  const result = await sendResendEmail({
    to,
    subject,
    text: withLinkUpTextFooter(text),
  });

  if (!result.ok) {
    console.error('Resend error', result.status, result.error);
    return jsonError('Resend failed', 502, 'resend_failed');
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonError('Server misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return jsonError('Unauthorized', 401);
  }
  const sessionUserId = authData.user.id;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Bad JSON', 400);
  }

  const type = body.type;
  const meetTypeName = body.meetTypeName?.trim();
  if (!type || !meetTypeName) {
    return jsonError('Missing type or meetTypeName', 400);
  }
  if (type !== 'meet_type_submitted' && type !== 'meet_type_approved' && type !== 'meet_type_rejected') {
    return jsonError('Invalid type', 400);
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { subject, text } = emailContent(type, meetTypeName, body.rejectionReason);

  if (type === 'meet_type_submitted') {
    const creatorId = body.creatorId ?? sessionUserId;
    if (creatorId !== sessionUserId) {
      return jsonError('Forbidden', 403);
    }

    const { data: admins, error: adminsErr } = await admin.rpc('get_admin_user_ids');
    if (adminsErr) {
      console.error('get_admin_user_ids', adminsErr.message);
      return jsonError('Could not load admins', 500);
    }

    const recipients = (admins ?? [])
      .map((row: { email?: string | null }) => row.email?.trim())
      .filter((email: string | undefined): email is string => !!email);

    if (!recipients.length) {
      return jsonResponse({ ok: true, skipped: 'no_admin_emails' });
    }

    const resendErr = await sendTransactionalEmail(recipients, subject, text);
    if (resendErr) return resendErr;
    return jsonResponse({ ok: true, sent: recipients.length });
  }

  const callerIsAdmin = await isAdminUser(admin, sessionUserId);
  if (!callerIsAdmin) {
    return jsonError('Forbidden', 403);
  }

  const recipientUserId = body.recipientUserId?.trim();
  if (!recipientUserId) {
    return jsonError('Missing recipientUserId', 400);
  }

  const recipientEmail = await resolveUserEmail(admin, recipientUserId);
  if (!recipientEmail) {
    return jsonResponse({ ok: true, skipped: 'no_recipient_email' });
  }

  const resendErr = await sendTransactionalEmail([recipientEmail], subject, text);
  if (resendErr) return resendErr;
  return jsonResponse({ ok: true, sent: 1 });
});
