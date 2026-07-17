import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default async function PrivacyPolicyPage() {
  let version: DbPrivacyPolicyVersion | null = null;

  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('privacy_policy_versions')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      version = (data as DbPrivacyPolicyVersion | null) ?? null;
    } catch {
      /* Supabase unavailable — show empty state */
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-xl font-extrabold text-foreground">Privacy Policy</h1>
        {version ? (
          <>
            <p className="mt-1 text-[12px] font-semibold text-muted">
              Version {version.version} · Effective {formatDate(version.effective_date)}
            </p>
            <article className="mt-6 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-foreground/85">
              {version.content}
            </article>
          </>
        ) : (
          <p className="mt-4 text-[14px] font-semibold text-muted">No privacy policy is currently available.</p>
        )}
      </div>
    </div>
  );
}
