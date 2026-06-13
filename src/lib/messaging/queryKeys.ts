export const INBOX_QUERY_KEY = 'inbox';

export function inboxQueryKey(userId: string | null | undefined) {
  return [INBOX_QUERY_KEY, userId] as const;
}
