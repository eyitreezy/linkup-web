import { getLastReadMap } from '@/lib/messaging/inboxCache';
import { formatGroupMentionsForDisplay } from '@/lib/messaging/groupMentions';
import {
  messageDisplayText,
  previewForLastMessage,
} from '@/lib/messaging/messagePreview';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

const MESSAGE_COLUMNS_BASE =
  'id, text, body, media_id, sender_id, created_at, edited_at, deleted_at, conversation_id';
const MESSAGE_COLUMNS_WITH_REPLY = `${MESSAGE_COLUMNS_BASE}, reply_to_message_id`;
const MESSAGE_COLUMNS_WITH_RECEIPT = `${MESSAGE_COLUMNS_WITH_REPLY}, receipt_hidden`;
const MESSAGE_COLUMNS_WITH_GROUP = `${MESSAGE_COLUMNS_WITH_RECEIPT}, group_sender_display`;

let replyColumnSupported: boolean | null = null;
let receiptColumnSupported: boolean | null = null;
let groupSenderColumnSupported: boolean | null = null;

export function messageSelectColumns(): string {
  if (replyColumnSupported === false) {
    return receiptColumnSupported === false
      ? MESSAGE_COLUMNS_BASE
      : `${MESSAGE_COLUMNS_BASE}, receipt_hidden`;
  }
  if (receiptColumnSupported === false) return MESSAGE_COLUMNS_WITH_REPLY;
  if (groupSenderColumnSupported === false) return MESSAGE_COLUMNS_WITH_RECEIPT;
  return MESSAGE_COLUMNS_WITH_GROUP;
}

export function normalizeMessageRow(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string | undefined,
    text: (row.text as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    media_id: (row.media_id as string | null) ?? null,
    sender_id: (row.sender_id as string | null) ?? null,
    created_at: row.created_at as string,
    edited_at: (row.edited_at as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    reply_to_message_id: (row.reply_to_message_id as string | null | undefined) ?? null,
    receipt_hidden: (row.receipt_hidden as boolean | undefined) ?? false,
    group_sender_display: (row.group_sender_display as string | null | undefined) ?? null,
  };
}

export type ChatMessageRow = {
  id: string;
  conversation_id?: string;
  text: string | null;
  body: string | null;
  media_id: string | null;
  sender_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id?: string | null;
  receipt_hidden?: boolean;
  group_sender_display?: string | null;
  mediaUrl?: string | null;
  mediaKind?: 'image' | 'video' | null;
};

export type InboxMemberPreview = {
  avatarUrl: string | null;
  name: string;
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
  isGroupChat?: boolean;
  groupAvatarUrl?: string | null;
  memberCount?: number;
  memberPreviews?: InboxMemberPreview[];
  planId?: string | null;
};

/** Unread conversations (last message from other party, not read locally). */
export async function countUnreadConversations(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const { rows } = await fetchInbox(client, userId);
  return rows.filter((r) => r.unread).length;
}

/** Inbox — mirrors mobile `messages.tsx` loadInbox (DM + group chats). */
export async function fetchInbox(
  client: SupabaseClient,
  userId: string
): Promise<{ rows: InboxRow[]; error: string | null }> {
  let groupConvIds: string[] = [];
  const { data: groupMemberships, error: groupMembersErr } = await client
    .from('group_chat_members')
    .select('conversation_id')
    .eq('user_id', userId)
    .is('removed_at', null);

  if (groupMembersErr) {
    const msg = groupMembersErr.message ?? '';
    if (!msg.includes('infinite recursion') && !msg.includes('group_chat_members')) {
      return { rows: [], error: groupMembersErr.message };
    }
    // RLS recursion on group_chat_members — fall back to 1:1 inbox until migration is applied.
  } else {
    groupConvIds = [...new Set((groupMemberships ?? []).map((r) => r.conversation_id as string))];
  }

  const dmFilter = `user_a.eq.${userId},user_b.eq.${userId}`;
  let convQuery = client
    .from('conversations')
    .select('id, user_a, user_b, created_at, is_group_chat, group_name, group_avatar_url, plan_id');
  if (groupConvIds.length > 0) {
    convQuery = convQuery.or(`${dmFilter},id.in.(${groupConvIds.join(',')})`);
  } else {
    convQuery = convQuery.or(dmFilter);
  }
  const { data: convs, error: ce } = await convQuery;

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

  let deletedForMeIds = new Set<string>();
  if (lastMsgIds.length > 0) {
    const { data: myDeletions } = await client
      .from('message_user_deletions')
      .select('message_id')
      .eq('user_id', userId)
      .in('message_id', lastMsgIds);
    deletedForMeIds = new Set((myDeletions ?? []).map((d) => d.message_id as string));
  }

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

  const dmConvs = convs.filter((c) => !c.is_group_chat);
  const groupConvs = convs.filter((c) => c.is_group_chat);

  const groupMemberCounts = new Map<string, number>();
  const groupMemberPreviews = new Map<string, InboxMemberPreview[]>();
  const groupMentionNameByConv = new Map<string, Map<string, string>>();
  if (groupConvs.length > 0) {
    const gIds = groupConvs.map((c) => c.id as string);
    const { data: gMembers } = await client
      .from('group_chat_members')
      .select('conversation_id, user_id')
      .in('conversation_id', gIds)
      .is('removed_at', null);
    const memberUserIds = [...new Set((gMembers ?? []).map((m) => m.user_id as string))];
    const { data: gProfiles } = memberUserIds.length
      ? await client
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', memberUserIds)
      : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };
    const gProfMap = new Map((gProfiles ?? []).map((p) => [p.user_id as string, p]));
    for (const gid of gIds) {
      const rows = (gMembers ?? []).filter((m) => m.conversation_id === gid);
      groupMemberCounts.set(gid, rows.length);
      const nameMap = new Map<string, string>();
      for (const m of rows) {
        const p = gProfMap.get(m.user_id as string);
        nameMap.set(m.user_id as string, (p?.display_name as string) ?? 'Member');
      }
      groupMentionNameByConv.set(gid, nameMap);
      groupMemberPreviews.set(
        gid,
        rows.slice(0, 4).map((m) => {
          const p = gProfMap.get(m.user_id as string);
          return {
            avatarUrl: (p?.avatar_url as string | null) ?? null,
            name: (p?.display_name as string) ?? 'Member',
          };
        })
      );
    }
  }

  const otherIds = dmConvs
    .map((c) => ((c.user_a as string) === userId ? (c.user_b as string) : (c.user_a as string)))
    .filter(Boolean) as string[];
  const uniqueOthers = [...new Set(otherIds)];

  const { data: profs } = uniqueOthers.length
    ? await client
        .from('profiles')
        .select('user_id, display_name, avatar_url, verified_badge')
        .in('user_id', uniqueOthers)
    : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null; verified_badge: boolean | null }[] };

  const profByUser = new Map((profs ?? []).map((p) => [p.user_id as string, p]));

  const out: InboxRow[] = convs.map((c) => {
    const isGroup = !!c.is_group_chat;
    const otherId = isGroup ? (c.id as string) : ((c.user_a as string) === userId ? (c.user_b as string) : (c.user_a as string))!;
    const prof = isGroup ? null : profByUser.get(otherId);
    const last = lastByConv.get(c.id as string);
    const mk = last ? mediaKindByMsg.get(last.id as string) ?? null : null;
    let preview =
      last && deletedForMeIds.has(last.id as string)
        ? 'Message deleted'
        : previewForLastMessage(
            last ? messageDisplayText(last) : null,
            mk,
            (last?.deleted_at as string) ?? null
          );
    if (isGroup && last && !deletedForMeIds.has(last.id as string)) {
      const nameMap = groupMentionNameByConv.get(c.id as string);
      if (nameMap) preview = formatGroupMentionsForDisplay(preview, nameMap);
    }
    const timeIso = (last?.created_at as string) ?? (c.created_at as string);
    const readAt = readMap[c.id as string];
    const unread =
      !!last &&
      (last.sender_id as string | null) !== userId &&
      (!readAt || new Date(last.created_at as string) > new Date(readAt));

    return {
      id: c.id as string,
      otherId,
      name: isGroup ? ((c.group_name as string) ?? 'Group chat') : ((prof?.display_name as string) ?? 'Member'),
      avatarUrl: isGroup ? null : ((prof?.avatar_url as string) ?? null),
      verified: isGroup ? false : !!prof?.verified_badge,
      preview: isGroup && !last ? `${groupMemberCounts.get(c.id as string) ?? 0} members` : preview,
      timeIso,
      unread,
      isGroupChat: isGroup,
      groupAvatarUrl: (c.group_avatar_url as string | null) ?? null,
      memberCount: groupMemberCounts.get(c.id as string),
      memberPreviews: groupMemberPreviews.get(c.id as string),
      planId: (c.plan_id as string | null) ?? null,
    };
  });

  out.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
  return { rows: out, error: null };
}

export async function fetchMessages(
  client: SupabaseClient,
  conversationId: string
): Promise<{ data: ChatMessageRow[] | null; error: Error | null }> {
  let cols = messageSelectColumns();
  let { data: rows, error } = await client
    .from('messages')
    .select(cols)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error?.code === '42703') {
    if (cols.includes('group_sender_display')) {
      groupSenderColumnSupported = false;
    } else if (cols.includes('receipt_hidden')) {
      receiptColumnSupported = false;
    } else if (cols.includes('reply_to_message_id')) {
      replyColumnSupported = false;
    }
    cols = messageSelectColumns();
    const retry = await client
      .from('messages')
      .select(cols)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    rows = retry.data;
    error = retry.error;
  }

  if (error) return { data: null, error: new Error(error.message) };
  const messages = (rows ?? []).map((r) => normalizeMessageRow(r as unknown as Record<string, unknown>));

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

export function buildForwardText(m: ChatMessageRow): string {
  const text = messageDisplayText(m)?.trim();
  if (text) return text;
  if (m.mediaKind === 'video') return 'Video';
  if (m.mediaKind === 'image' || m.mediaUrl || m.media_id) return 'Photo';
  return 'Message';
}

export async function sendTextMessage(
  client: SupabaseClient,
  conversationId: string,
  senderId: string,
  text: string,
  replyToMessageId?: string | null
): Promise<{ data: ChatMessageRow | null; error: string | null }> {
  const body = text.trim();
  if (!body) return { data: null, error: 'Message is empty' };

  const payload: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    text: body,
    moderation_status: 'clean',
  };
  if (replyToMessageId && replyColumnSupported !== false) {
    payload.reply_to_message_id = replyToMessageId;
  }

  let { data, error } = await client
    .from('messages')
    .insert(payload)
    .select(messageSelectColumns())
    .single();

  if (error?.code === '42703' && payload.reply_to_message_id) {
    replyColumnSupported = false;
    delete payload.reply_to_message_id;
    const retry = await client
      .from('messages')
      .insert(payload)
      .select(messageSelectColumns())
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { data: null, error: error.message };
  return { data: normalizeMessageRow(data as unknown as Record<string, unknown>), error: null };
}

export async function forwardMessageToConversation(
  client: SupabaseClient,
  source: ChatMessageRow,
  targetConversationId: string,
  senderId: string
): Promise<{ error: string | null }> {
  const snippet = buildForwardText(source);
  const forwarded = `↪ ${snippet}`;
  const { error } = await sendTextMessage(client, targetConversationId, senderId, forwarded);
  return { error };
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
