export const INBOX_QUERY_KEY = 'inbox';
export const MESSAGES_QUERY_KEY = 'messages';

export function inboxQueryKey(userId: string | null | undefined) {
  return [INBOX_QUERY_KEY, userId] as const;
}

export function messagesQueryKey(conversationId: string) {
  return [MESSAGES_QUERY_KEY, conversationId] as const;
}
