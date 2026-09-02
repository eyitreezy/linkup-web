/**
 * Web Push notifications for new chat messages.
 *
 * Accepts either:
 *   { "messageId": "uuid" }                           (pg_net / manual)
 *   { "record": { "id": "uuid", ... } }               (Supabase Database Webhook on INSERT)
 *
 * Database Webhook setup (no custom body field needed):
 *   Table: messages | Event: INSERT | Function: send-message-push
 *   Headers: Content-type application/json, Authorization Bearer <service_role>
 *
 * Secrets (Supabase Dashboard → Edge Functions):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

function sanitizeVapidKey(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

const VAPID_PUBLIC_KEY = sanitizeVapidKey(Deno.env.get('VAPID_PUBLIC_KEY') ?? '');
const VAPID_PRIVATE_KEY = sanitizeVapidKey(Deno.env.get('VAPID_PRIVATE_KEY') ?? '');
const VAPID_SUBJECT = (Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@linkup.ng').trim();

let vapidReady = false;

function ensureVapidConfigured(): boolean {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
    return true;
  } catch (e) {
    console.error('Invalid VAPID keys:', e);
    return false;
  }
}

type RequestBody = {
  messageId?: string;
  record?: { id?: string };
  /** Some webhook payloads nest the row differently. */
  new?: { id?: string };
};

function resolveMessageId(body: RequestBody): string | null {
  const direct = body.messageId?.trim();
  if (direct) return direct;

  const fromRecord = body.record?.id?.trim();
  if (fromRecord) return fromRecord;

  const fromNew = body.new?.id?.trim();
  if (fromNew) return fromNew;

  return null;
}

function previewBody(text: string | null, body: string | null, hasMedia: boolean): string {
  const raw = (text ?? body ?? '').trim();
  if (raw) return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
  if (hasMedia) return 'Sent an attachment';
  return 'New message';
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  if (!ensureVapidConfigured()) {
    return jsonError('Push not configured', 503, 'vapid_not_configured');
  }

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!serviceRole || authHeader !== `Bearer ${serviceRole}`) {
    return jsonError('Unauthorized', 401);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const messageId = resolveMessageId(body);
  if (!messageId) {
    return jsonError('messageId required (send messageId or a database webhook record.id)', 400);
  }

  const admin = getSupabaseAdmin();

  const { data: message, error: messageErr } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, text, body, media_id')
    .eq('id', messageId)
    .single();

  if (messageErr || !message) {
    return jsonError('Message not found', 404);
  }

  const { data: conv } = await admin
    .from('conversations')
    .select('id, user_a, user_b, is_group_chat, group_name')
    .eq('id', message.conversation_id)
    .single();

  if (!conv) {
    return jsonError('Conversation not found', 404);
  }

  const { data: senderProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', message.sender_id)
    .maybeSingle();

  const senderName = (senderProfile?.display_name as string | null)?.trim() || 'Someone';
  const preview = previewBody(
    message.text as string | null,
    message.body as string | null,
    !!message.media_id
  );

  const recipientIds = new Set<string>();

  if (conv.is_group_chat) {
    const { data: members } = await admin
      .from('group_chat_members')
      .select('user_id')
      .eq('conversation_id', conv.id)
      .is('removed_at', null);
    for (const member of members ?? []) {
      if (member.user_id !== message.sender_id) {
        recipientIds.add(member.user_id as string);
      }
    }
  } else {
    const peer =
      conv.user_a === message.sender_id ? (conv.user_b as string | null) : (conv.user_a as string | null);
    if (peer) recipientIds.add(peer);
  }

  if (recipientIds.size === 0) {
    return jsonResponse({ sent: 0, errors: 0 });
  }

  const title = conv.is_group_chat
    ? ((conv.group_name as string | null)?.trim() || 'Group chat')
    : senderName;

  const chatUrl = `/messages?c=${conv.id}`;
  let sent = 0;
  let errorCount = 0;

  for (const recipientId of recipientIds) {
    const { data: subs } = await admin
      .from('web_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId);

    if (!subs?.length) continue;

    const payload = JSON.stringify({
      type: 'message',
      title,
      body: conv.is_group_chat ? `${senderName}: ${preview}` : preview,
      chatId: conv.id,
      url: chatUrl,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          payload
        );
        sent++;
        await admin
          .from('web_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint as string);
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint as string);
        } else {
          errorCount++;
        }
      }
    }
  }

  return jsonResponse({ sent, errors: errorCount });
});
