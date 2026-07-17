import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrivacyConsentMethod } from '@/types/database';

export async function recordPrivacyConsentServer(
  supabase: SupabaseClient,
  userId: string,
  consentMethod: PrivacyConsentMethod
): Promise<{ ok: boolean }> {
  const { data: version } = await supabase
    .from('privacy_policy_versions')
    .select('id')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version?.id) return { ok: true };

  const { error } = await supabase.from('privacy_policy_consents').insert({
    user_id: userId,
    policy_version_id: version.id,
    consent_method: consentMethod,
  });

  if (error?.code === '23505') return { ok: true };
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[privacy] server consent insert failed:', error.message);
    }
    return { ok: false };
  }
  return { ok: true };
}
