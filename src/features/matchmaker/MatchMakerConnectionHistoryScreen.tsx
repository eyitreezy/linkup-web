'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { fetchMatchMakerConnectionHistory } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

function formatDuration(connectedAt: string, endedAt: string): string {
  const days = Math.max(
    1,
    Math.ceil((new Date(endedAt).getTime() - new Date(connectedAt).getTime()) / 86400000)
  );
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function MatchMakerConnectionHistoryScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const historyQuery = useQuery({
    queryKey: ['matchmaker-connection-history', user?.id],
    queryFn: async () => {
      const { data, error } = await fetchMatchMakerConnectionHistory(createClient());
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!user?.id,
  });

  const rows = historyQuery.data ?? [];

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <MatchMakerPageHeader
          kicker="MatchMaker"
          title="My Connection History"
          subtitle="This is private and visible only to you."
          backLabel="Back to pool"
          onBack={() => router.push('/matchmaker')}
        />

        {historyQuery.isLoading ? (
          <div className="mt-8 h-40 animate-pulse rounded-3xl bg-[#FBF5F0]" />
        ) : rows.length === 0 ? (
          <AppEmptyState className="mt-10" title="No previous connections yet." description="" />
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const photo = row.primary_photo_url ?? row.partner_avatar_url;
              return (
                <li
                  key={row.connection_id}
                  className="flex items-center gap-3 rounded-2xl border bg-white p-3"
                  style={{ borderColor: MATCHMAKER_THEME.border }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold"
                      style={{ background: MATCHMAKER_THEME.surfaceWarm, color: MATCHMAKER_THEME.accent }}
                    >
                      {(row.partner_name ?? '?').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-extrabold">{row.partner_name ?? 'Member'}</p>
                    <p className="text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                      {formatDuration(row.connected_at, row.ended_at)} · {row.outcome_label}
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                    {new Date(row.ended_at).toLocaleDateString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
