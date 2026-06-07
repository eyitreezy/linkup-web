import { createClient } from '@/lib/supabase/client';
import type { DbNotification } from '@/types/database';

export async function countUnreadNotifications(userId: string): Promise<number> {
  const client = createClient();
  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchUserNotifications(userId: string) {
  const client = createClient();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { rows: [] as DbNotification[], error: error.message };
  return { rows: (data ?? []) as DbNotification[], error: null };
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
  return client.from('notifications').delete().eq('id', id);
}
