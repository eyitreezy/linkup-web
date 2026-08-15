import type { SupabaseClient } from '@supabase/supabase-js';

/** Resolve a valid user JWT for authenticated Supabase calls (RPC + Edge Functions). */
export async function ensureSupabaseAccessToken(client: SupabaseClient): Promise<string> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error('NOT_AUTHENTICATED');

  let session = sessionData.session;

  if (!session?.access_token) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error('NOT_AUTHENTICATED');
    session = (await client.auth.getSession()).data.session ?? null;
  }

  if (!session?.access_token) throw new Error('NOT_AUTHENTICATED');

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec < 120) {
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }
  }

  return session.access_token;
}

export async function edgeFunctionAuthHeaders(
  client: SupabaseClient
): Promise<{ Authorization: string }> {
  const token = await ensureSupabaseAccessToken(client);
  return { Authorization: `Bearer ${token}` };
}
