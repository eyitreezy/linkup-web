/**
 * Email when a member receives a surfaced MatchMaker interest (never matched before).
 */
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getResendConfig, sendResendEmail, withLinkUpTextFooter } from '../_shared/resend.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = {
  recipientUserId?: string;
  senderUserId?: string;
  senderName?: string;
};

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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!getResendConfig()) {
    return jsonError('Email not configured', 503, 'resend_not_configured');
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON body', 400, 'invalid_json');
  }

  const recipientUserId = body.recipientUserId?.trim();
  const senderName = body.senderName?.trim() || 'Someone';

  if (!recipientUserId) {
    return jsonError('recipientUserId required', 400, 'missing_recipient');
  }

  const admin = getSupabaseAdmin();
  const email = await resolveUserEmail(admin, recipientUserId);
  if (!email) {
    return jsonResponse({ ok: true, skipped: 'no_email' });
  }

  const text = `${senderName} expressed interest in you on MatchMaker. Open LinkUp to review your interest queue.`;
  const result = await sendResendEmail({
    to: [email],
    subject: 'LinkUp: new MatchMaker interest',
    text: withLinkUpTextFooter(text),
  });

  if (!result.ok) {
    console.error('send-matchmaker-interest-email', result.status, result.error);
    return jsonError('Resend failed', 502, 'resend_failed');
  }

  return jsonResponse({ ok: true, resendEmailId: result.id });
});
