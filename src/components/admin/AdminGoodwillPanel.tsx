'use client';

import { AdminPrimaryButton } from '@/features/admin/adminUi';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { createClient } from '@/lib/supabase/client';
import type { DbGoodwillCredit, GoodwillSource } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';
import { IoHeartCircle } from 'react-icons/io5';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function AdminGoodwillPanel({ userId }: { userId: string }) {
  const [credits, setCredits] = useState<DbGoodwillCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueAmount, setIssueAmount] = useState('');
  const [issueSource, setIssueSource] = useState<GoodwillSource>('promo');
  const [issueNote, setIssueNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const client = createClient();
    const { data, error } = await client
      .from('goodwill_credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) setErr(error.message);
    else setErr(null);
    setCredits((data ?? []) as DbGoodwillCredit[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleIssue() {
    const amountCents = Math.round(parseFloat(issueAmount) * 100);
    if (!amountCents || amountCents <= 0) return;

    setBusy(true);
    setErr(null);
    const client = createClient();
    const { error } = await client.rpc('admin_issue_goodwill_credit', {
      p_user_id: userId,
      p_amount_cents: amountCents,
      p_source: issueSource,
      p_admin_note: issueNote.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setIssueAmount('');
    setIssueNote('');
    void load();
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center gap-2">
        <IoHeartCircle size={20} className="text-[#D97706]" />
        <h4 className="text-[14px] font-extrabold text-foreground">Goodwill credits</h4>
      </div>

      {err ? <p className="text-[12px] font-semibold text-[#EF4444]">{err}</p> : null}

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[#EDE8FF]/70" />
      ) : (
        <div className="space-y-1">
          {credits.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-[13px] last:border-0"
            >
              <span className="font-extrabold text-foreground">
                {formatNGN(c.amount - c.used_amount)} / {formatNGN(c.amount)}
              </span>
              <span className="text-right text-[11px] font-semibold text-muted">
                {c.source} · {c.tier_at_award ?? 'FREE'} · expires {formatDate(c.expires_at)}
              </span>
            </div>
          ))}
          {credits.length === 0 ? (
            <p className="py-2 text-[12px] font-semibold text-muted">No goodwill credits</p>
          ) : null}
        </div>
      )}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount (NGN)"
            value={issueAmount}
            onChange={(e) => setIssueAmount(e.target.value)}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
          />
          <select
            value={issueSource}
            onChange={(e) => setIssueSource(e.target.value as GoodwillSource)}
            className="rounded-xl border border-border px-2 py-2 text-[13px] font-semibold"
          >
            <option value="promo">Promo</option>
            <option value="dispute_resolution">Dispute resolution</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Note (optional, shown to user)"
          value={issueNote}
          onChange={(e) => setIssueNote(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2 text-[14px] font-semibold"
        />
        <AdminPrimaryButton
          className="w-full"
          disabled={!issueAmount || busy}
          onClick={() => void handleIssue()}
        >
          Issue goodwill credit
        </AdminPrimaryButton>
      </div>
    </div>
  );
}
