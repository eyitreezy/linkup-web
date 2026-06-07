import { createClient } from '@/lib/supabase/client';
import type { DbUserPresence } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

function presenceChannelTopic(userId: string): string {
  return `public-presence:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export async function fetchUserPresence(userId: string): Promise<DbUserPresence | null> {
  const client = createClient();
  const { data } = await client.from('user_presence').select('*').eq('user_id', userId).maybeSingle();
  return (data as DbUserPresence | null) ?? null;
}

export function subscribeUserPresenceRealtime(
  userId: string,
  onChange: (row: DbUserPresence | null) => void
): () => void {
  if (!userId) return () => {};

  const client = createClient();
  const topic = presenceChannelTopic(userId);
  const channel: RealtimeChannel = client.channel(topic);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${userId}` },
    (payload) => {
      if (payload.eventType === 'DELETE') {
        onChange(null);
        return;
      }
      onChange(payload.new as DbUserPresence);
    }
  );

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
