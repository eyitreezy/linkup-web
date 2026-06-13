'use client';

import { TierBadge } from '@/components/subscription/TierBadge';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { createClient } from '@/lib/supabase/client';
import type { DbUser } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoDiamondOutline } from 'react-icons/io5';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function trialStatusLabel(user: DbUser, type: 'silver' | 'gold'): string {
  const activatedAt = type === 'silver' ? user.silver_trial_activated_at : user.gold_trial_activated_at;
  const expiresAt = type === 'silver' ? user.silver_trial_expires_at : user.gold_trial_expires_at;

  if (!activatedAt) return 'Never used';
  if (expiresAt && new Date(expiresAt) > new Date()) {
    return `Active until ${formatDate(expiresAt)}`;
  }
  return 'Used (expired)';
}

export function AdminTrialPanel({ userId }: { userId: string }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const client = createClient();
    const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) setErr(error.message);
    else setErr(null);
    setUser((data as DbUser | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrialAction(trialType: 'silver' | 'gold', action: 'grant' | 'extend' | 'revoke') {
    setBusy(true);
    setErr(null);
    const client = createClient();
    const { error } = await client.rpc('admin_adjust_trial', {
      p_user_id: userId,
      p_trial_type: trialType,
      p_action: action,
      p_days: 7,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    void load();
  }

  if (loading) {
    return <div className="mt-4 h-20 animate-pulse rounded-xl bg-[#EDE8FF]/70" />;
  }

  if (!user) return null;

  const effectiveTier = resolveClientEffectiveTier(user);

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center gap-2">
        <IoDiamondOutline size={20} className="text-primary" />
        <h4 className="text-[14px] font-extrabold text-foreground">Trials & subscription</h4>
      </div>

      {err ? <p className="text-[12px] font-semibold text-[#EF4444]">{err}</p> : null}

      <div className="space-y-1.5 text-[13px]">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2">
          <span className="font-semibold text-muted">Effective tier</span>
          <TierBadge tier={effectiveTier} size="sm" />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2">
          <span className="font-semibold text-muted">Subscription</span>
          <span className="text-right font-extrabold text-foreground">
            {user.subscription_tier}
            {user.subscription_expires_at ? ` · until ${formatDate(user.subscription_expires_at)}` : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2">
          <span className="font-semibold text-muted">Silver trial</span>
          <span className="text-right font-semibold text-foreground">{trialStatusLabel(user, 'silver')}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2">
          <span className="font-semibold text-muted">Gold trial</span>
          <span className="text-right font-semibold text-foreground">{trialStatusLabel(user, 'gold')}</span>
        </div>
        {user.premium_until ? (
          <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2">
            <span className="font-semibold text-muted">Legacy premium</span>
            <span className="font-semibold text-foreground">until {formatDate(user.premium_until)}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        {(['silver', 'gold'] as const).map((trialType) => (
          <div key={trialType} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {trialType} trial
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTrialAction(trialType, 'grant')}
                className="rounded-lg border border-border px-2 py-1 text-[11px] font-extrabold text-primary hover:bg-[#F5F6FA] disabled:opacity-50"
              >
                Grant 7d
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTrialAction(trialType, 'extend')}
                className="rounded-lg border border-border px-2 py-1 text-[11px] font-extrabold text-primary hover:bg-[#F5F6FA] disabled:opacity-50"
              >
                +7d
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTrialAction(trialType, 'revoke')}
                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/admin/users/${userId}/subscription-events`}
        className="block text-[12px] font-extrabold text-primary hover:underline"
      >
        View subscription events →
      </Link>
    </div>
  );
}
