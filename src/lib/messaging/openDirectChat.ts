import { getOrCreateConversation } from '@/lib/conversations';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Create conversation if needed and return chat path for Next.js navigation. */
export async function openDirectChatPath(
  client: SupabaseClient,
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  const conversationId = await getOrCreateConversation(client, currentUserId, otherUserId);
  return `/chat/${conversationId}`;
}
