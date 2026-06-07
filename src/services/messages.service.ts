import { getLastReadMap } from '@/lib/messaging/inboxCache';
import {
  messageDisplayText,
  previewForLastMessage,
} from '@/lib/messaging/messagePreview';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

export type ChatMessageRow = {
  id: string;
  text: string | null;
  body: string | null;
  media_id: string | null;
  sender_id: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  mediaUrl?: string | null;
  mediaKind?: 'image' | 'video' | null;
};

export type InboxRow = {
  id: string;
  otherId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  preview: string;
  timeIso: string;
  unread: boolean;
};

/** Unread conversations (last message from other party, not read locally). */
export async function countUnreadConversations(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const { rows } = await fetchInbox(client, userId);
  return rows.filter((r) => r.unread).length;
}

/** Inbox — mirrors mobile `messages.tsx` loadInbox (no updated_at on conversations). */
export async function fetchInbox(
  client: SupabaseClient,
  userId: string
): Promise<{ rows: InboxRow[]; error: string | null }> {
  const { data: convs, error: ce } = await client
    .from('conversations')
    .select('id, user_a, user_b, created_at')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (ce) return { rows: [], error: ce.message };
  if (!convs?.length) return { rows: [], error: null };

  const ids = convs.map((c) => c.id as string);

  const { data: allLast, error: le } = await client
    .from('messages')
    .select('id, conversation_id, text, body, media_id, sender_id, created_at, deleted_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  if (le) return { rows: [], error: le.message };

  const readMap = getLastReadMap();

  const lastByConv = new Map<string, (typeof allLast)[0]>();
  for (const m of allLast ?? []) {
    if (!lastByConv.has(m.conversation_id as string)) {
      lastByConv.set(m.conversation_id as string, m);
    }
  }

  const lastRows = [...lastByConv.values()];
  const lastMsgIds = lastRows.map((m) => m.id as string);
  const lastMediaFkIds = [...new Set(lastRows.map((m) => m.media_id).filter(Boolean))] as string[];
  const mediaKindByMsg = new Map<string, 'image' | 'video'>();

  if (lastMsgIds.length > 0) {
    const { data: byParent } = await client
      .from('media')
      .select('parent_id, mime_type')
      .eq('parent_table', 'messages')
      .in('parent_id', lastMsgIds);
    for (const row of byParent ?? []) {
      const mime = (row.mime_type as string) ?? '';
      const kind = mime.startsWith('video/') ? 'video' : 'image';
      if (row.parent_id) mediaKindByMsg.set(row.parent_id as string, kind);
    }
  }

  if (lastMediaFkIds.length > 0) {
    const { data: byId } = await client.from('media').select('id, mime_type').in('id', lastMediaFkIds);
    const kindByMediaId = new Map<string, 'image' | 'video'>();
    for (const row of byId ?? []) {
      const mime = (row.mime_type as string) ?? '';
      kindByMediaId.set(row.id as string, mime.startsWith('video/') ? 'video' : 'image');
    }
    for (const last of lastRows) {
      if (last.media_id && !mediaKindByMsg.has(last.id as string)) {
        const k = kindByMediaId.get(last.media_id as string);
        if (k) mediaKindByMsg.set(last.id as string, k);
      }
    }
  }

  const otherIds = convs.map((c) =>
    (c.user_a as string) === userId ? (c.user_b as string) : (c.user_a as string)
  );
  const uniqueOthers = [...new Set(otherIds)];

  const { data: profs } = await client
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', uniqueOthers);

  const profByUser = new Map((profs ?? []).map((p) => [p.user_id as string, p]));

  const out: InboxRow[] = convs.map((c) => {
    const otherId =
      (c.user_a as string) === userId ? (c.user_b as string) : (c.user_a as string);
    const prof = profByUser.get(otherId);
    const last = lastByConv.get(c.id as string);
    const mk = last ? mediaKindByMsg.get(last.id as string) ?? null : null;
    const preview = previewForLastMessage(
      last ? messageDisplayText(last) : null,
      mk,
      (last?.deleted_at as string) ?? null
    );
    const timeIso = (last?.created_at as string) ?? (c.created_at as string);
    const readAt = readMap[c.id as string];
    const unread =
      !!last &&
      (last.sender_id as string) !== userId &&
      (!readAt || new Date(last.created_at as string) > new Date(readAt));

    return {
      id: c.id as string,
      otherId,
      name: (prof?.display_name as string) ?? 'Member',
      avatarUrl: (prof?.avatar_url as string) ?? null,
      verified: !!prof?.verified_badge,
      preview,
      timeIso,
      unread,
    };
  });

  out.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
  return { rows: out, error: null };
}

export async function fetchMessages(
  client: SupabaseClient,
  conversationId: string
): Promise<{ data: ChatMessageRow[] | null; error: Error | null }> {
  const { data: rows, error } = await client
    .from('messages')
    .select('id, text, body, media_id, sender_id, created_at, edited_at, deleted_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: new Error(error.message) };
  const messages = (rows ?? []) as ChatMessageRow[];

  const msgIds = messages.map((m) => m.id);
  const mediaFkIds = [...new Set(messages.map((m) => m.media_id).filter(Boolean))] as string[];

  const mediaByMsgId = new Map<string, { mime_type: string; storage_bucket: string; storage_path: string }>();

  if (msgIds.length > 0) {
    const { data: byParent } = await client
      .from('media')
      .select('parent_id, mime_type, storage_bucket, storage_path')
      .eq('parent_table', 'messages')
      .in('parent_id', msgIds);
    for (const row of byParent ?? []) {
      if (row.parent_id) {
        mediaByMsgId.set(row.parent_id as string, {
          mime_type: (row.mime_type as string) ?? '',
          storage_bucket: (row.storage_bucket as string) ?? 'chat-media',
          storage_path: (row.storage_path as string) ?? '',
        });
      }
    }
  }

  if (mediaFkIds.length > 0) {
    const { data: byId } = await client
      .from('media')
      .select('id, mime_type, storage_bucket, storage_path')
      .in('id', mediaFkIds);
    const byMediaId = new Map(
      (byId ?? []).map((r) => [
        r.id as string,
        {
          mime_type: (r.mime_type as string) ?? '',
          storage_bucket: (r.storage_bucket as string) ?? 'chat-media',
          storage_path: (r.storage_path as string) ?? '',
        },
      ])
    );
    for (const m of messages) {
      if (m.media_id && !mediaByMsgId.has(m.id)) {
        const meta = byMediaId.get(m.media_id);
        if (meta) mediaByMsgId.set(m.id, meta);
      }
    }
  }

  for (const m of messages) {
    const meta = mediaByMsgId.get(m.id);
    if (!meta?.storage_path) continue;
    const mime = meta.mime_type;
    m.mediaKind = mime.startsWith('video/') ? 'video' : 'image';
    const { data: signed } = await client.storage
      .from(meta.storage_bucket)
      .createSignedUrl(meta.storage_path, 3600);
    m.mediaUrl = signed?.signedUrl ?? null;
  }

  return { data: messages, error: null };
}

export async function sendTextMessage(
  client: SupabaseClient,
  conversationId: string,
  senderId: string,
  text: string
): Promise<{ data: ChatMessageRow | null; error: string | null }> {
  const body = text.trim();
  if (!body) return { data: null, error: 'Message is empty' };

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text: body,
      moderation_status: 'clean',
    })
    .select('id, text, body, media_id, sender_id, created_at, edited_at, deleted_at')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as ChatMessageRow, error: null };
}

export async function sendMediaMessage(
  client: SupabaseClient,
  conversationId: string,
  senderId: string,
  file: File,
  caption?: string
): Promise<{ error: string | null }> {
  const isVideo = file.type.startsWith('video/');
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { error: 'Video too large — choose a clip under ~14 MB.' };
  }

  const captionTrim = caption?.trim() || null;
  const { data: inserted, error: insErr } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text: captionTrim,
      moderation_status: 'pending',
    })
    .select('id')
    .single();

  if (insErr || !inserted) return { error: insErr?.message ?? 'Could not create message' };

  const msgId = inserted.id as string;
  const ext = isVideo ? 'mp4' : 'jpg';
  const contentType = isVideo ? 'video/mp4' : file.type || 'image/jpeg';
  const path = `${senderId}/${msgId}-${Date.now()}.${ext}`;

  const { error: upErr } = await client.storage.from('chat-media').upload(path, file, {
    contentType,
    upsert: false,
  });
  if (upErr) {
    await client.from('messages').delete().eq('id', msgId);
    return { error: upErr.message };
  }

  const { data: publicUrlData } = client.storage.from('chat-media').getPublicUrl(path);

  const { data: medRow, error: medErr } = await client
    .from('media')
    .insert({
      parent_table: 'messages',
      parent_id: msgId,
      storage_bucket: 'chat-media',
      storage_path: path,
      mime_type: contentType,
      media_type: isVideo ? 'video' : 'image',
      media_url: publicUrlData.publicUrl,
      created_by: senderId,
    })
    .select('id')
    .single();

  if (medErr || !medRow) {
    await client.from('messages').delete().eq('id', msgId);
    await client.storage.from('chat-media').remove([path]);
    return { error: medErr?.message ?? 'Could not save attachment' };
  }

  const { error: updErr } = await client
    .from('messages')
    .update({ media_id: medRow.id })
    .eq('id', msgId);

  if (updErr) {
    await client.from('media').delete().eq('id', medRow.id);
    await client.from('messages').delete().eq('id', msgId);
    await client.storage.from('chat-media').remove([path]);
    return { error: updErr.message };
  }

  return { error: null };
}

export function subscribeToMessages(
  client: SupabaseClient,
  conversationId: string,
  onMessage: () => void
) {
  const channel = client.channel(`messages:${conversationId}`);
  const handler = { schema: 'public' as const, table: 'messages' as const, filter: `conversation_id=eq.${conversationId}` };
  channel
    .on('postgres_changes', { event: 'INSERT', ...handler }, onMessage)
    .on('postgres_changes', { event: 'UPDATE', ...handler }, onMessage)
    .on('postgres_changes', { event: 'DELETE', ...handler }, onMessage)
    .subscribe();
  return channel;
}
