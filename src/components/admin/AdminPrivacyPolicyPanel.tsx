'use client';

import { createClient } from '@/lib/supabase/client';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function AdminPrivacyPolicyPanel() {
  const [currentVersion, setCurrentVersion] = useState<DbPrivacyPolicyVersion | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refetchCurrentVersion = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('privacy_policy_versions')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) setErr(error.message);
    else setErr(null);
    setCurrentVersion((data as DbPrivacyPolicyVersion | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetchCurrentVersion();
  }, [refetchCurrentVersion]);

  async function handlePublish() {
    if (!newVersion.trim() || !newContent.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from('privacy_policy_versions').insert({
      version: newVersion.trim(),
      content: newContent.trim(),
      summary_of_changes: newSummary.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refetchCurrentVersion();
    setNewVersion('');
    setNewContent('');
    setNewSummary('');
  }

  if (loading) {
    return <div className="h-28 animate-pulse rounded-[22px] bg-[#EDE8FF]/70" />;
  }

  return (
    <div className="rounded-[22px] border border-border/60 bg-white p-4 space-y-4">
      {err ? <p className="text-[12px] font-semibold text-[#EF4444]">{err}</p> : null}

      {currentVersion ? (
        <div className="rounded-xl bg-[#F5F6FA] px-3 py-2">
          <p className="text-[12px] font-semibold text-muted">
            Current: v{currentVersion.version} · effective {formatDate(currentVersion.effective_date)}
          </p>
        </div>
      ) : (
        <p className="text-[12px] font-semibold text-muted">No policy published yet.</p>
      )}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Publish new version</p>
        <input
          type="text"
          placeholder="Version (e.g. 1.1)"
          value={newVersion}
          onChange={(e) => setNewVersion(e.target.value)}
          className="w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <textarea
          placeholder="Full policy content (markdown supported)"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={8}
          className="w-full resize-none rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="text"
          placeholder="Summary of changes (optional, shown to existing users)"
          value={newSummary}
          onChange={(e) => setNewSummary(e.target.value)}
          className="w-full rounded-xl border border-border bg-[#F8F9FC] px-3 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={busy || !newVersion.trim() || !newContent.trim()}
          className="w-full rounded-xl bg-gray-900 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
        >
          {busy ? 'Publishing…' : 'Publish new version'}
        </button>
      </div>
    </div>
  );
}
