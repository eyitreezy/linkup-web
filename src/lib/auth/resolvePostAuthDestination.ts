import type { SupabaseClient } from '@supabase/supabase-js';

export function safeAuthNextPath(raw: string | null | undefined, fallback = '/discover'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export async function resolvePostAuthDestinationForUserId(
  supabase: SupabaseClient,
  userId: string,
  nextPath?: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.onboarding_status === 'pending') {
    return '/onboarding';
  }

  return safeAuthNextPath(nextPath);
}

export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  nextPath?: string | null
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeAuthNextPath(nextPath);
  return resolvePostAuthDestinationForUserId(supabase, user.id, nextPath);
}
