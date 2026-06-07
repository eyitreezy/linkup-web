'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbDispute, PlanDisputeStatus } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoDocumentTextOutline, IoShieldCheckmarkOutline, IoWalletOutline } from 'react-icons/io5';

type EscrowDisp = { id: string; reason: string; status: string; escrow_id: string };

type DisputeFilterTab = 'all' | 'plans' | 'escrow';

type FilterEmptyConfig = {
  title: string;
  description: string;
  emoji: string;
  titleAccent?: string;
};

const FILTER_LABELS: Record<DisputeFilterTab, string> = {
  all: 'All',
  plans: 'Plan issues',
  escrow: 'Escrow',
};

function titleCaseStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function planStatusClass(status: PlanDisputeStatus): string {
  switch (status) {
    case 'pending':
    case 'reviewing':
      return 'bg-primary/10 text-primary';
    case 'resolved':
      return 'bg-emerald-500/15 text-emerald-800';
    case 'rejected':
      return 'bg-red-500/10 text-red-700';
    default:
      return 'bg-muted/10 text-muted';
  }
}

function escrowStatusClass(status: string): string {
  const open = status === 'open' || status === 'under_review';
  if (open) return 'bg-primary/10 text-primary';
  if (status === 'resolved') return 'bg-emerald-500/15 text-emerald-800';
  return 'bg-muted/10 text-muted';
}

export function DisputesScreen() {
  const user = useAuthStore((s) => s.user);
  const [escrowRows, setEscrowRows] = useState<EscrowDisp[]>([]);
  const [planRows, setPlanRows] = useState<DbDispute[]>([]);
  const [filter, setFilter] = useState<DisputeFilterTab>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setEscrowRows([]);
      setPlanRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();

    const { data: esc } = await client
      .from('escrow_transactions')
      .select('id')
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`);
    const ids = esc?.map((e) => e.id) ?? [];
    if (!ids.length) {
      setEscrowRows([]);
    } else {
      const { data } = await client
        .from('escrow_disputes')
        .select('id, reason, status, escrow_id')
        .in('escrow_id', ids);
      setEscrowRows((data as EscrowDisp[]) ?? []);
    }

    const { data: pd } = await client
      .from('disputes')
      .select('*')
      .or(`reporter_id.eq.${user.id},reported_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(40);
    setPlanRows((pd as DbDispute[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const showPlans = filter === 'all' || filter === 'plans';
  const showEscrow = filter === 'all' || filter === 'escrow';
  const bothEmpty = planRows.length === 0 && escrowRows.length === 0;

  const filterEmpty = useMemo((): FilterEmptyConfig | null => {
    if (filter === 'plans') {
      return {
        title: 'No plan issues yet',
        description: 'Safety reports about meetups you’re involved in will appear here.',
        emoji: '🛡️',
      };
    }
    if (filter === 'escrow') {
      return {
        title: 'No escrow disputes',
        description: 'Payment disputes tied to your escrow activity will show up in this tab.',
        emoji: '💳',
      };
    }
    return null;
  }, [filter]);

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view disputes.
      </p>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Trust"
        title="Disputes"
        subtitle="Escrow-linked cases and plan safety reports — same data as the mobile app."
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as DisputeFilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-full px-4 py-2 text-[13px] font-extrabold ${
              filter === tab ? 'linkup-gradient-primary text-white' : 'border border-border bg-white text-primary'
            }`}
          >
            {FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : bothEmpty ? (
        <AppEmptyState
          emoji="⚖️"
          title="Your disputes are quiet"
          titleAccent="quiet"
          description="If something goes wrong with escrow or a meetup, cases land here — we review with the same process as the mobile app."
          tips={[
            {
              icon: IoWalletOutline,
              text: 'Escrow disputes appear when funded meetups need a formal review',
              iconBgClassName: 'bg-primary/10',
            },
            {
              icon: IoShieldCheckmarkOutline,
              text: 'Plan safety reports stay separate from casual chat — track status here',
              iconBgClassName: 'bg-emerald-500/10',
              iconClassName: 'text-emerald-600',
            },
            {
              icon: IoDocumentTextOutline,
              text: 'Open a support ticket anytime — we can link it to your case',
              iconBgClassName: 'bg-secondary/10',
              iconClassName: 'text-secondary',
            },
          ]}
          action={{ label: 'Contact support', href: '/support' }}
          secondaryAction={{ label: 'Browse Discover', href: '/discover', variant: 'secondary' }}
        />
      ) : (
        <div className="space-y-6">
          {showPlans && planRows.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-muted">Plan issues</h2>
              <ul className="space-y-2">
                {planRows.map((d) => (
                  <li key={d.id} className="linkup-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-extrabold text-foreground">
                        {d.reporter_note?.slice(0, 80) ?? d.category.replace(/_/g, ' ')}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${planStatusClass(d.status)}`}
                      >
                        {titleCaseStatus(d.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-muted">
                      {new Date(d.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : showPlans && !bothEmpty && filterEmpty ? (
            <AppEmptyState
              emoji={filterEmpty.emoji}
              title={filterEmpty.title}
              titleAccent={filterEmpty.titleAccent}
              description={filterEmpty.description}
              action={{ label: 'View all disputes', onClick: () => setFilter('all'), variant: 'secondary' }}
            />
          ) : null}

          {showEscrow && escrowRows.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-muted">Escrow</h2>
              <ul className="space-y-2">
                {escrowRows.map((d) => (
                  <li key={d.id} className="linkup-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-extrabold text-foreground">{d.reason}</p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${escrowStatusClass(d.status)}`}
                      >
                        {titleCaseStatus(d.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-muted">Escrow {d.escrow_id.slice(0, 8)}…</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : showEscrow && !bothEmpty && filter === 'escrow' && escrowRows.length === 0 && filterEmpty ? (
            <AppEmptyState
              emoji={filterEmpty.emoji}
              title={filterEmpty.title}
              titleAccent={filterEmpty.titleAccent}
              description={filterEmpty.description}
              action={{ label: 'View all disputes', onClick: () => setFilter('all'), variant: 'secondary' }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
