'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import {
  MatchMakerGateModal,
  type MatchMakerGateModalState,
} from '@/features/matchmaker/MatchMakerGateModal';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPool } from '@/features/matchmaker/MatchMakerPool';
import { MatchMakerPoolPreview } from '@/features/matchmaker/MatchMakerPoolPreview';
import type { MatchMakerGate } from '@/lib/matchmaker/gates';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import {
  fetchMatchMakerGateState,
  fetchMatchMakerPoolPreview,
} from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoTimeOutline } from 'react-icons/io5';

function daysUntil(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function MatchMakerSkeleton() {
  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <TabPageHeader
          kicker="MatchMaker"
          title="Your pool"
          description="One connection at a time. Take your time."
          icon={<MatchMakerTabIcon size={22} />}
        />
        <div className="mt-6 h-80 animate-pulse rounded-3xl bg-[#FBF5F0]" />
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}

const GATED_MODAL: MatchMakerGateModalState[] = ['subscription', 'kyc', 'cooldown', 'suspended'];

export function MatchMakerRoot() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [gate, setGate] = useState<MatchMakerGate | 'loading'>('loading');
  const [cooldownUntil, setCooldownUntil] = useState<string | undefined>();
  const [suspensionUntil, setSuspensionUntil] = useState<string | undefined>();
  const [connectionId, setConnectionId] = useState<string | undefined>();
  const [modalDismissed, setModalDismissed] = useState(false);
  const [poolPreview, setPoolPreview] = useState<Awaited<ReturnType<typeof fetchMatchMakerPoolPreview>>['data']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function checkGate() {
      setGate('loading');
      setModalDismissed(false);
      setError(null);

      const client = createClient();
      const { data, error: gateError } = await fetchMatchMakerGateState(client);
      if (cancelled) return;

      if (gateError || !data) {
        setError(gateError ?? 'Could not load MatchMaker');
        return;
      }

      const resolvedGate = data.gate === 'pool' ? 'open' : data.gate;
      setGate(resolvedGate);
      setCooldownUntil(data.cooldown_until);
      setSuspensionUntil(data.suspension_until);
      setConnectionId(data.connection_id);

      if (GATED_MODAL.includes(resolvedGate as MatchMakerGateModalState)) {
        const preview = await fetchMatchMakerPoolPreview(client, 6);
        if (!cancelled) setPoolPreview(preview.data);
      }
    }

    void checkGate();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (gate !== 'connection' || !connectionId) return;
    router.replace(`/matchmaker/connection/${connectionId}`);
  }, [gate, connectionId, router]);

  useEffect(() => {
    if (gate === 'intent') {
      router.replace('/matchmaker/declare');
    } else if (gate === 'values') {
      router.replace('/matchmaker/values');
    }
  }, [gate, router]);

  if (!user) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-center text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            <Link href="/login" className="font-extrabold text-primary">
              Sign in
            </Link>{' '}
            to use MatchMaker.
          </p>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (gate === 'loading') return <MatchMakerSkeleton />;

  if (error) {
    return (
      <MatchMakerLayout>
        <MatchMakerPageShell>
          <p className="text-center text-[14px] font-semibold text-[#EF4444]">{error}</p>
        </MatchMakerPageShell>
      </MatchMakerLayout>
    );
  }

  if (gate === 'connection' || gate === 'intent' || gate === 'values') {
    return (
      <MatchMakerLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9B1B4B] border-t-transparent" />
        </div>
      </MatchMakerLayout>
    );
  }

  const isGated = GATED_MODAL.includes(gate as MatchMakerGateModalState);
  const gateModal = gate as MatchMakerGateModalState;

  return (
    <div className="relative min-h-full w-full">
      <div
        className={cn(isGated && 'pointer-events-none select-none')}
        style={isGated ? { filter: 'blur(12px)' } : undefined}
      >
        {isGated ? <MatchMakerPoolPreview profiles={poolPreview} /> : <MatchMakerPool />}
      </div>

      {isGated && modalDismissed ? (
        <div className="fixed left-0 right-0 top-0 z-40 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <IoTimeOutline size={16} className="shrink-0 text-amber-600" />
          <p className="flex-1 text-[13px] font-extrabold text-amber-900">
            {gate === 'cooldown'
              ? `MatchMaker resumes in ${daysUntil(cooldownUntil)} days`
              : gate === 'suspended'
                ? `MatchMaker suspended, ${daysUntil(suspensionUntil)} days remaining`
                : gate === 'subscription'
                  ? 'Upgrade to Gold to access MatchMaker'
                  : 'Complete verification to access MatchMaker'}
          </p>
        </div>
      ) : null}

      {isGated && !modalDismissed ? (
        <MatchMakerGateModal
          gate={gateModal}
          cooldownDaysRemaining={daysUntil(cooldownUntil)}
          cooldownUntil={cooldownUntil}
          suspensionDaysRemaining={daysUntil(suspensionUntil)}
          onDismiss={() => setModalDismissed(true)}
        />
      ) : null}
    </div>
  );
}
