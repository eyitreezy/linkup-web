/** Shared React Query keys for meet type lists (client + server safe). */

export function meetTypesQueryKey(userId: string | undefined) {
  return ['meet-types', userId] as const;
}

export function meetrMeetTypesQueryKey(userId: string | undefined) {
  return ['meetr-meet-types', userId] as const;
}
