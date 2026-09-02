import {
  normalizeMessageRow,
  type ChatMessageRow,
  type MessageRealtimePayload,
} from '@/services/messages.service';
import type { QueryClient } from '@tanstack/react-query';
import { messagesQueryKey } from '@/lib/messaging/queryKeys';

export type { MessageRealtimePayload };

function sortByCreatedAt(rows: ChatMessageRow[]): ChatMessageRow[] {
  return [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function upsertMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  incoming: ChatMessageRow
): void {
  queryClient.setQueryData<ChatMessageRow[]>(messagesQueryKey(conversationId), (prev) => {
    if (!prev?.length) return prev;
    const idx = prev.findIndex((m) => m.id === incoming.id);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = { ...next[idx], ...incoming };
      return next;
    }
    return sortByCreatedAt([...prev, incoming]);
  });
}

export function removeMessageFromCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string
): void {
  queryClient.setQueryData<ChatMessageRow[]>(messagesQueryKey(conversationId), (prev) =>
    prev?.filter((m) => m.id !== messageId)
  );
}

export function applyMessageRealtimeEvent(
  queryClient: QueryClient,
  conversationId: string,
  payload: MessageRealtimePayload
): 'cache-updated' | 'needs-refetch' {
  if (payload.eventType === 'DELETE') {
    const messageId = payload.old.id as string | undefined;
    if (messageId) {
      removeMessageFromCache(queryClient, conversationId, messageId);
      return 'cache-updated';
    }
    return 'needs-refetch';
  }

  const row = normalizeMessageRow(payload.new);
  if (row.conversation_id && row.conversation_id !== conversationId) {
    return 'cache-updated';
  }

  if (row.media_id && !row.mediaUrl) {
    return 'needs-refetch';
  }

  upsertMessageInCache(queryClient, conversationId, row);
  return 'cache-updated';
}
