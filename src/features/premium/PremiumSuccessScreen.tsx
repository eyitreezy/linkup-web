'use client';

import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  IoAirplaneOutline,
  IoArrowUndoOutline,
  IoCheckmarkCircle,
  IoFlashOutline,
  IoHeartOutline,
  IoOptionsOutline,
  IoSparkles,
} from 'react-icons/io5';

const UNLOCKED = [
  { icon: IoFlashOutline, title: 'Boost plans', body: 'Top placement in the feed' },
  { icon: IoOptionsOutline, title: 'Advanced filters', body: 'Price, distance, verified hosts' },
  { icon: IoAirplaneOutline, title: 'Travel mode', body: 'Browse before you arrive' },
  { icon: IoHeartOutline, title: "Who's interested", body: 'Saves and interest on your plans' },
  { icon: IoArrowUndoOutline, title: 'Undo hides', body: 'Bring back plans you dismissed' },
] as const;

function formatRenewal(until: string | null | undefined): string | null {
  if (!until) return null;
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PremiumSuccessScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      return fetchUserProfileBundle(client, user.id);
    },
    enabled: !!user?.id,
    refetchOnMount: 'always',
  });

  const dbUser = data?.dbUser ?? null;
  const active = isPremiumSubscriber(dbUser);
  const renews = formatRenewal(dbUser?.premium_until ?? null);

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Membership"
        title={active ? "You're all set" : 'Thanks for upgrading'}
        subtitle={
          active && renews
            ? `Your membership is active through ${renews}.`
            : 'If you just paid, perks may take a moment while Paystack confirms.'
        }
        backHref="/profile"
        backLabel="Back to profile"
        actions={
          <span className="inline-flex items-center gap-2 rounded-full linkup-gradient-primary px-4 py-2 text-[13px] font-extrabold text-white shadow-md">
            <IoCheckmarkCircle size={18} aria-hidden />
            {active ? 'Premium active' : 'Payment received'}
          </span>
        }
      />

      <div className="mx-auto max-w-lg rounded-3xl p-[2px] linkup-gradient-primary shadow-xl">
        <div className="rounded-[22px] bg-surface px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/15">
            <IoSparkles size={40} className="text-primary" aria-hidden />
          </div>
          <p className="font-display text-xl font-extrabold text-foreground">Welcome to Premium</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            Perks are now available across Discover, plans, and your profile.
          </p>
        </div>
      </div>

      <PremiumSectionHead title="Unlocked now" />

      <ul className="space-y-3">
        {UNLOCKED.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="linkup-card flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-primary/20 bg-background">
                <Icon size={20} className="text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-[15px] font-extrabold text-foreground">{item.title}</p>
                <p className="text-[13px] font-semibold text-muted">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/discover"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white shadow-md transition hover:opacity-95"
        >
          Explore plans
        </Link>
        <Link
          href="/profile"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-border bg-surface px-8 text-[15px] font-extrabold text-foreground transition hover:bg-[#EDE8FF]/50"
        >
          View profile
        </Link>
      </div>

      {isLoading ? (
        <p className="text-center text-[13px] font-semibold text-muted">Refreshing membership…</p>
      ) : null}
    </div>
  );
}
