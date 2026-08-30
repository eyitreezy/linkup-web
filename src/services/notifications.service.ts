import { filterNotificationsForUser } from '@/lib/notifications/filterNotificationsForUser';
import { createClient } from '@/lib/supabase/client';
import type { DbNotification } from '@/types/database';

export async function countUnreadNotifications(userId: string, isAdmin = false): Promise<number> {
  const client = createClient();
  const { data, error } = await client
    .from('notifications')
    .select('type')
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return filterNotificationsForUser((data ?? []) as { type: string }[], isAdmin).length;
}

export async function fetchUserNotifications(userId: string, isAdmin = false) {
  const client = createClient();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { rows: [] as DbNotification[], error: error.message };
  return {
    rows: filterNotificationsForUser((data ?? []) as DbNotification[], isAdmin),
    error: null,
  };
}

export async function markNotificationRead(id: string) {
  const client = createClient();
  return client.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string) {
  const client = createClient();
  return client.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export async function deleteNotification(id: string) {
  const client = createClient();
  const { error } = await client.from('notifications').delete().eq('id', id);
  return { error: error?.message ?? null };
}
