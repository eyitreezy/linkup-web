import { isAdminOnlyNotificationType } from '@/lib/notifications/adminOnlyNotificationTypes';

export function filterNotificationsForUser<T extends { type: string }>(
  rows: T[],
  isAdmin: boolean
): T[] {
  return rows.filter((n) => !isAdminOnlyNotificationType(n.type) || isAdmin);
}
