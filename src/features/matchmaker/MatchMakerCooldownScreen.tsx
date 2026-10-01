'use client';

import { FormCard } from '@/components/settings/FormCard';
import {
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
} from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { fetchMatchMakerGateState } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { IoTimeOutline } from 'react-icons/io5';

function daysUntil(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export function MatchMakerCooldownScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const gateQuery = useQuery({
    queryKey: ['matchmaker-gate', user?.id],
    queryFn: async () => {
      const { data, error } = await fetchMatchMakerGateState(createClient());
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  const remaining = daysUntil(gateQuery.data?.cooldown_until);
  const progress = Math.min(100, Math.round(((30 - remaining) / 30) * 100));

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="py-12 text-center">
        <IoTimeOutline size={48} className="mx-auto" style={{ color: MATCHMAKER_THEME.textMuted }} />
        <h1 className="mt-6 font-display text-2xl font-extrabold">MatchMaker is paused for 30 days.</h1>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          MatchMaker is built for intentional connections. We want to make sure the pool stays that way.
        </p>
        <div className="mx-auto mt-8 max-w-sm">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: MATCHMAKER_THEME.border }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: MATCHMAKER_THEME.primary }} />
          </div>
          <p className="mt-2 text-[14px] font-extrabold">{remaining} days remaining</p>
        </div>
        <FormCard className="mt-8 text-left">
          <p className="text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            All other LinkUp features are fully available.
          </p>
        </FormCard>
        {remaining === 0 ? (
          <div className="mt-8">
            <MatchMakerOutlinedButton onClick={() => router.push('/matchmaker/reentry')}>
              Continue to MatchMaker
            </MatchMakerOutlinedButton>
          </div>
        ) : (
          <p className="mt-8 text-[13px] font-semibold opacity-60" style={{ color: MATCHMAKER_THEME.disabled }}>
            MatchMaker resumes in {remaining} days
          </p>
        )}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
