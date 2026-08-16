'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import {
  friendlyStatus,
  statusVisual,
  toUiStatus,
} from '@/features/trust/verificationUi';
import { isUserVerified } from '@/lib/verification/access';
import {
  fetchLatestVerificationRequest,
} from '@/lib/verification/submitVerification';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbVerificationEvent } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  IoAlertCircle,
  IoCheckmarkCircle,
  IoFingerPrint,
  IoInformationCircle,
  IoShieldCheckmark,
  IoTime,
} from 'react-icons/io5';

function StatusIcon({ kind }: { kind: ReturnType<typeof statusVisual>['icon'] }) {
  const cls = 'text-primary';
  if (kind === 'verified') return <IoShieldCheckmark size={32} className="text-emerald-600" />;
  if (kind === 'pending') return <IoTime size={32} className="text-amber-600" />;
  if (kind === 'rejected') return <IoAlertCircle size={32} className="text-red-600" />;
  return <IoFingerPrint size={32} className={cls} />;
}

export function VerificationScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const dbUser = data?.dbUser ?? null;
  const v = toUiStatus(dbUser?.verification_status);
  const copy = friendlyStatus(v);
  const vis = statusVisual(v);
  const ok = isUserVerified(dbUser?.verification_status);

  const { data: trail } = useQuery({
    queryKey: ['verification-trail', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as DbVerificationEvent[];
      const req = await fetchLatestVerificationRequest(user.id);
      if (!req) return [];
      const client = createClient();
      const { data: events } = await client
        .from('verification_events')
        .select('*')
        .eq('verification_id', req.id)
        .order('created_at', { ascending: true });
      return (events ?? []) as DbVerificationEvent[];
    },
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to view verification.
      </p>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Trust & identity"
        title="Verification"
        subtitle="Your status, what it unlocks, and a transparent audit trail, same as the mobile app."
      />

      <div className="flex gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/15">
          <StatusIcon kind={vis.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Current status</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-extrabold text-foreground">{copy.title}</h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${vis.pill}`}>
              {copy.title}
            </span>
          </div>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">{copy.sub}</p>
        </div>
      </div>

      <FormCard>
        <div className="flex gap-3 rounded-2xl bg-primary/5 p-4">
          <IoInformationCircle size={22} className="shrink-0 text-primary" />
          <p className="text-[13px] font-semibold leading-relaxed text-muted">
            Verification is required to create plans, negotiate offers, and use escrow. Premium does not
            replace this step.
          </p>
        </div>
        {!ok ? (
          <Link
            href="/kyc"
            className="mt-4 flex min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md"
          >
            Start or resume verification
          </Link>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-4">
            <IoCheckmarkCircle size={24} className="text-emerald-600" />
            <div>
              <p className="font-extrabold text-emerald-900">You&apos;re all set</p>
              <p className="text-[13px] font-semibold text-emerald-800">
                Verified for trust-gated features across LinkUp.
              </p>
            </div>
          </div>
        )}
      </FormCard>

      <PremiumSectionHead title="Your verification trail" />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : trail && trail.length > 0 ? (
        <ul className="space-y-2">
          {trail.map((e) => (
            <li key={e.id} className="linkup-card flex gap-3 p-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-[14px] font-extrabold text-foreground">
                  {e.event_type.replace(/_/g, ' ')}
                </p>
                <p className="text-[12px] font-semibold text-muted">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <AppEmptyState
          emoji="🛡️"
          title="No verification events yet"
          description="Submit identity verification to start your trust trail. Required for offers and escrow on LinkUp."
          action={{ label: 'Begin verification', href: '/kyc' }}
          secondaryAction={{ label: 'Help & support', href: '/support', variant: 'secondary' }}
        />
      )}
    </div>
  );
}
