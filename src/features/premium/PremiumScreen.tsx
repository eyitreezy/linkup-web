'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { isPremiumSubscriber } from '@/lib/premium/access';
import {
  formatTierPrice,
  PREMIUM_TIERS,
  type PremiumTierId,
} from '@/lib/premium/catalog';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  IoAirplaneOutline,
  IoArrowForward,
  IoArrowUndoOutline,
  IoEyeOutline,
  IoFlashOutline,
  IoHeartOutline,
  IoLogoUsd,
  IoOptionsOutline,
  IoShieldOutline,
  IoStarOutline,
} from 'react-icons/io5';

const FEATURES = [
  {
    icon: IoFlashOutline,
    title: 'Boost your plans',
    body: 'Jump to the top of the feed for more offers.',
  },
  {
    icon: IoEyeOutline,
    title: 'Who viewed your profile',
    body: 'See recent visitors (privacy-safe counters in-app).',
  },
  {
    icon: IoHeartOutline,
    title: "Who's into your plans",
    body: 'Interest and saves surfaced for your meetups.',
  },
  {
    icon: IoOptionsOutline,
    title: 'Advanced filters',
    body: 'Filter by price, distance, and verified hosts.',
  },
  {
    icon: IoAirplaneOutline,
    title: 'Travel mode',
    body: 'Browse another city before you arrive.',
  },
  {
    icon: IoArrowUndoOutline,
    title: 'Undo actions',
    body: 'Bring back the last plan you hid from the feed.',
  },
  {
    icon: IoStarOutline,
    title: 'Spotlight & visibility',
    body: 'Longer feed presence and boosted placement.',
  },
  {
    icon: IoShieldOutline,
    title: 'Priority dispute handling',
    body: 'Premium reporters get a faster review queue flag.',
  },
] as const;

function formatRenewal(until: string | null | undefined): string | null {
  if (!until) return null;
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PremiumScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [selected, setSelected] = useState<PremiumTierId>(
    PREMIUM_TIERS.find((t) => t.recommended)?.id ?? 'monthly'
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      return fetchUserProfileBundle(client, user.id);
    },
    enabled: !!user?.id,
  });

  const dbUser = data?.dbUser ?? null;
  const subscriber = isPremiumSubscriber(dbUser);
  const renews = formatRenewal(dbUser?.premium_until ?? null);

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view Premium plans.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-28 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#FFF0F5]/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/60" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <p className="text-[14px] font-semibold text-[#EF4444]">
        {data?.error ?? (error instanceof Error ? error.message : 'Could not load account')}
        <button
          type="button"
          className="ml-2 font-extrabold text-primary underline"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-8 pb-10">
      {subscriber ? (
        <TabPageHeader
          kicker="Active member"
          title="Your Premium perks"
          description="Premium helps people discover your plans. Verification is still required for hosting paid meetups and escrow — paying never skips identity checks."
          icon={<IoStarOutline size={22} />}
          trailing={
            renews ? (
              <span className="rounded-full bg-[#EDE8FF] px-2.5 py-1 text-[10px] font-extrabold text-primary min-[360px]:px-3 min-[360px]:text-[11px] sm:text-[12px]">
                Renews {renews}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#EDE8FF] px-2.5 py-1 text-[10px] font-extrabold text-primary min-[360px]:px-3 min-[360px]:text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                Active
              </span>
            )
          }
        />
      ) : (
        <SettingsPageHeader
          kicker="Membership"
          title="Stand out and get more offers"
          subtitle="Premium helps people discover your plans. Verification is still required for hosting paid meetups and escrow — paying never skips identity checks."
          backHref="/profile"
          backLabel="Back to profile"
          actions={
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/20 bg-white/90 px-3 py-2 text-[13px] font-extrabold text-primary shadow-sm">
              <IoLogoUsd size={16} aria-hidden />
              Premium
            </span>
          }
        />
      )}

      <PremiumSectionHead title="What you unlock" />

      <ul className="space-y-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <li
              key={f.title}
              className="linkup-card flex items-center gap-4 p-4 transition hover:border-primary/25"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/20 bg-background">
                <Icon size={22} className="text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-extrabold text-foreground">{f.title}</p>
                <p className="mt-1 text-[14px] font-semibold leading-snug text-muted">{f.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <PremiumSectionHead title="Choose a plan" className="pt-2" />

      <div className="space-y-3">
        {PREMIUM_TIERS.map((tier) => {
          const on = selected === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelected(tier.id)}
              className={cn(
                'w-full rounded-2xl text-left transition active:scale-[0.995]',
                on ? 'p-[2px] linkup-gradient-primary shadow-lg' : 'linkup-card p-5 hover:border-primary/25'
              )}
            >
              <div
                className={cn(
                  'rounded-[14px]',
                  on ? 'bg-white/98 p-5' : ''
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[18px] font-extrabold text-foreground">{tier.title}</span>
                  {tier.recommended ? (
                    on ? (
                      <span className="rounded-full linkup-gradient-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                        Recommended
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold uppercase text-primary">
                        Recommended
                      </span>
                    )
                  ) : null}
                </div>
                <p className="mt-1 text-[14px] font-semibold text-muted">{tier.subtitle}</p>
                <p className="mt-3 text-[15px] font-extrabold text-foreground">
                  {formatTierPrice(tier)} · +{tier.bonusBoostCredits} boosts
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => router.push(`/premium/checkout?tier=${selected}`)}
        className="flex w-full min-h-[56px] items-center justify-center gap-2.5 rounded-full linkup-gradient-primary px-6 text-[17px] font-extrabold text-white shadow-lg transition hover:opacity-95 active:scale-[0.985]"
      >
        {subscriber ? 'Extend or change plan' : 'Continue'}
        <IoArrowForward size={20} aria-hidden />
      </button>

      <p className="text-center text-[13px] font-semibold leading-relaxed text-muted">
        Paystack opens in a secure tab. Entitlements activate after webhook confirmation — use demo
        unlock on checkout only in development.
      </p>
    </div>
  );
}
