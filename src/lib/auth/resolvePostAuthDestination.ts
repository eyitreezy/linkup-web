import type { SupabaseClient } from '@supabase/supabase-js';

export function safeAuthNextPath(raw: string | null | undefined, fallback = '/discover'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

function onboardingDestinationWithPreservedQuery(nextPath?: string | null): string {
  const safe = safeAuthNextPath(nextPath, '/onboarding');
  if (!safe.startsWith('/onboarding')) return '/onboarding';

  const queryIndex = safe.indexOf('?');
  if (queryIndex === -1) return '/onboarding';

  const query = safe.slice(queryIndex + 1);
  return query ? `/onboarding?${query}` : '/onboarding';
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
    return onboardingDestinationWithPreservedQuery(nextPath);
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
