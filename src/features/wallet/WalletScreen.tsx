'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { GoodwillCreditRow } from '@/components/wallet/GoodwillCreditRow';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbGoodwillCredit, DbWalletLedgerRow } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  IoHeartCircle,
  IoPulse,
  IoReceiptOutline,
  IoShieldCheckmark,
  IoSparkles,
  IoTimeOutline,
  IoWallet,
} from 'react-icons/io5';

function formatMoney(cents: number, currency = 'NGN'): string {
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

function sourcePretty(source: string): string {
  return source.replace(/_/g, ' ');
}

export function WalletScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return {
          ledger: [] as DbWalletLedgerRow[],
          goodwill: [] as DbGoodwillCredit[],
          goodwillHistory: [] as DbGoodwillCredit[],
        };
      }
      const client = createClient();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const [l, g, history] = await Promise.all([
        client
          .from('wallet_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(80),
        client
          .from('goodwill_credits')
          .select('*')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: true })
          .limit(40),
        client
          .from('goodwill_credits')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);
      if (l.error) throw new Error(l.error.message);
      if (g.error) throw new Error(g.error.message);
      if (history.error) throw new Error(history.error.message);
      return {
        ledger: (l.data ?? []) as DbWalletLedgerRow[],
        goodwill: (g.data ?? []) as DbGoodwillCredit[],
        goodwillHistory: (history.data ?? []) as DbGoodwillCredit[],
      };
    },
    enabled: !!user?.id,
  });

  const ledger = data?.ledger ?? [];
  const goodwill = data?.goodwill ?? [];
  const goodwillHistory = data?.goodwillHistory ?? [];

  let balanceCents = 0;
  for (const row of ledger) {
    if (row.is_display_only) continue;
    if (row.type === 'credit') balanceCents += row.amount;
    else balanceCents -= row.amount;
  }

  const expiringSoonCredits = goodwillHistory.filter((c) => {
    const daysUntilExpiry = (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7 && c.used_amount < c.amount;
  });
  const expiringSoonTotal = expiringSoonCredits.reduce(
    (sum, c) => sum + (c.amount - c.used_amount),
    0
  );

  let goodwillRemaining = 0;
  for (const c of goodwill) {
    goodwillRemaining += Math.max(c.amount - c.used_amount, 0);
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view your wallet.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <TabPageHeader
        kicker="Your money hub"
        title="Wallet"
        description="Cash from escrow releases and refunds. Goodwill credits lower fees on future escrows — not withdrawable cash."
        icon={<IoWallet size={22} />}
      />

      {error ? (
        <p className="text-[14px] font-semibold text-[#EF4444]">
          {error instanceof Error ? error.message : 'Could not load wallet'}
          <button
            type="button"
            className="ml-2 font-extrabold text-primary underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {isLoading || isFetching ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-3xl bg-[#EDE8FF]/80" />
          <div className="h-28 animate-pulse rounded-2xl bg-[#FFF9E6]/80" />
        </div>
      ) : (
        <>
          <div className="rounded-3xl linkup-gradient-primary px-4 py-5 shadow-lg min-[360px]:px-6 min-[360px]:py-6">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-wide text-white/90">
                  Available balance
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                  Live
                </span>
              </div>
              <p className="mt-2 text-[28px] font-extrabold tracking-tight text-white min-[360px]:text-[34px]">
                {formatMoney(balanceCents)}
              </p>
              <p className="mt-2 text-[14px] font-semibold text-white/90">
                Tracked from secure holds, refunds, and releases on your plans.
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-white/25 pt-4 text-[12px] font-bold text-white/85">
                <IoShieldCheckmark size={16} />
                Protected · same stack as escrow
              </div>
          </div>

          <div className="linkup-card border border-[#FCD34D]/45 bg-gradient-to-br from-[#FFF9E6] to-[#FFE8F0] p-4 min-[360px]:p-6">
            <div className="flex items-center gap-2">
              <IoHeartCircle size={22} className="text-[#D97706]" />
              <h2 className="text-[17px] font-extrabold text-foreground">Goodwill credits</h2>
            </div>
            <p className="mt-2 text-[22px] font-extrabold text-[#B45309] min-[360px]:text-[26px]">
              {formatMoney(goodwillRemaining)}
            </p>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
              Issued when a host cancels within 48h or no-shows. Offsets platform fees on future escrows ·
              expires 60 days from issue.
            </p>
            {goodwill.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-[#FCD34D]/40 pt-4">
                {goodwill.map((credit) => {
                  const remaining = Math.max(credit.amount - credit.used_amount, 0);
                  const tier = credit.tier_at_award;
                  return (
                    <li
                      key={credit.id}
                      className="flex items-center justify-between gap-3 text-[13px] font-semibold text-muted"
                    >
                      <span>
                        {formatMoney(remaining)} remaining
                        {tier && tier !== 'FREE' ? (
                          <span className="ml-1 text-[11px] text-gray-400">
                            ({tier === 'PLATINUM' ? '2× enhanced' : '1.5× accelerated'})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px]">
                        Expires {new Date(credit.expires_at).toLocaleDateString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {expiringSoonCredits.length > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3">
              <IoTimeOutline size={18} className="shrink-0 text-amber-600" />
              <p className="text-[14px] font-semibold text-amber-800">
                {formatNGN(expiringSoonTotal)} in goodwill credits expire within 7 days
              </p>
            </div>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-[15px] font-extrabold text-foreground">Goodwill history</h3>
            {goodwillHistory.length === 0 ? (
              <p className="py-4 text-[14px] font-semibold text-muted">No goodwill credits yet</p>
            ) : (
              <div className="linkup-card divide-y divide-border/50 overflow-hidden">
                {goodwillHistory.map((credit) => (
                  <GoodwillCreditRow key={credit.id} credit={credit} />
                ))}
              </div>
            )}
          </section>

          <div className="linkup-card flex gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDE8FF] text-primary">
              <IoTimeOutline size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground">Withdrawals</h3>
              <p className="mt-1 text-[14px] font-semibold text-muted">
                Not enabled in this MVP. When we turn them on, requests will show up here for review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IoPulse size={18} className="text-secondary" />
            <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-foreground">
              Recent activity
            </h2>
          </div>

          {ledger.length === 0 ? (
            <AppEmptyState
              icon={<IoReceiptOutline size={36} className="text-primary" />}
              title="No movements yet"
              description="Credits, debits, and goodwill from paid meetups will show here — synced with your LinkUp wallet."
              action={{ label: 'Browse Discover', href: '/discover' }}
              secondaryAction={{ label: 'View offers', href: '/offers', variant: 'secondary' }}
            />
          ) : (
            <ul className="space-y-2">
              {ledger.map((row) => {
                if (row.source === 'goodwill' && row.is_display_only) {
                  return (
                    <li key={row.id} className="linkup-card px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#059669]">
                          <IoSparkles size={14} />
                          Goodwill applied to platform fee
                        </span>
                        <span className="text-[14px] font-extrabold text-[#059669]">
                          −{formatNGN(row.amount)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-semibold text-muted">
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </li>
                  );
                }

                return (
                  <li key={row.id} className="linkup-card relative overflow-hidden pl-1">
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1 ${
                        row.type === 'credit' ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                      }`}
                      aria-hidden
                    />
                    <div className="flex items-center justify-between gap-4 py-4 pl-4 pr-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-extrabold text-foreground">
                            {row.type === 'credit' ? 'Credit' : 'Debit'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              row.type === 'credit'
                                ? 'bg-[#10B981]/12 text-[#059669]'
                                : 'bg-[#EF4444]/10 text-[#EF4444]'
                            }`}
                          >
                            {sourcePretty(row.source)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] font-semibold text-muted">
                          {new Date(row.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-[16px] font-extrabold tabular-nums ${
                          row.type === 'debit' ? 'text-[#EF4444]' : 'text-[#059669]'
                        }`}
                      >
                        {row.type === 'credit' ? '+' : '−'}
                        {formatMoney(row.amount)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
