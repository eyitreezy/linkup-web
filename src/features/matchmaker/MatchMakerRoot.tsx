'use client';

import { MatchMakerPool } from '@/features/matchmaker/MatchMakerPool';
import { MatchMakerLayout } from '@/features/matchmaker/MatchMakerLayout';
import { gateRedirectPath } from '@/lib/matchmaker/gates';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { fetchMatchMakerGateState } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';

function GateScreen({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <MatchMakerLayout>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <MatchMakerTabIcon size={56} className="text-[#9B1B4B]" />
        <h1 className="mt-6 font-display text-2xl font-extrabold">{title}</h1>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          {body}
        </p>
        <Link
          href={ctaHref}
          className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-full font-extrabold text-white shadow-md"
          style={{ background: MATCHMAKER_THEME.ctaGradient }}
        >
          {ctaLabel}
        </Link>
      </div>
    </MatchMakerLayout>
  );
}

export function MatchMakerRoot() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const gateQuery = useQuery({
    queryKey: ['matchmaker-gate', user?.id],
    queryFn: async () => {
      const client = createClient();
      const { data, error } = await fetchMatchMakerGateState(client);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const state = gateQuery.data;
    if (!state) return;
    const redirect = gateRedirectPath(state);
    if (redirect && state.gate !== 'pool') {
      router.replace(redirect);
    }
  }, [gateQuery.data, router]);

  if (!user) {
    return (
      <MatchMakerLayout>
        <p className="p-6 text-center text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          <Link href="/login" className="font-extrabold text-primary">
            Sign in
          </Link>{' '}
          to use MatchMaker.
        </p>
      </MatchMakerLayout>
    );
  }

  if (gateQuery.isLoading) {
    return (
      <MatchMakerLayout>
        <div className="mx-auto max-w-md animate-pulse space-y-4 p-6">
          <div className="h-48 rounded-2xl bg-[#FBF5F0]" />
          <div className="h-12 rounded-full bg-[#EDE0D4]/80" />
        </div>
      </MatchMakerLayout>
    );
  }

  if (gateQuery.error) {
    return (
      <MatchMakerLayout>
        <p className="p-6 text-center text-[14px] font-semibold text-[#EF4444]">
          {gateQuery.error instanceof Error ? gateQuery.error.message : 'Could not load MatchMaker'}
        </p>
      </MatchMakerLayout>
    );
  }

  const gate = gateQuery.data?.gate;

  if (gate === 'subscription') {
    return (
      <GateScreen
        title="MatchMaker is for Gold members"
        body="Upgrade to Gold or Platinum to enter MatchMaker and connect with serious-minded members."
        ctaHref="/subscription"
        ctaLabel="Upgrade to Gold"
      />
    );
  }

  if (gate === 'kyc') {
    return (
      <GateScreen
        title="Verification required"
        body="MatchMaker requires identity verification to protect every member's safety and seriousness."
        ctaHref="/kyc"
        ctaLabel="Complete verification"
      />
    );
  }

  if (gate === 'cooldown') {
    return (
      <GateScreen
        title="MatchMaker is paused"
        body="Your MatchMaker access is paused. All other LinkUp features remain available."
        ctaHref="/matchmaker/suspended"
        ctaLabel="View details"
      />
    );
  }

  if (gate === 'intent' || gate === 'values' || gate === 'connection') {
    return (
      <MatchMakerLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9B1B4B] border-t-transparent" />
        </div>
      </MatchMakerLayout>
    );
  }

  return <MatchMakerPool />;
}
