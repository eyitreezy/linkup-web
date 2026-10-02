'use client';

import { FormCard } from '@/components/settings/FormCard';
import { ToggleRow } from '@/components/settings/ToggleRow';
import {
  MatchMakerLayout,
  MatchMakerOutlinedButton,
  MatchMakerPageShell,
} from '@/features/matchmaker/MatchMakerLayout';
import { MatchMakerPageHeader } from '@/features/matchmaker/MatchMakerPageHeader';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import {
  deleteMatchMakerProfile,
  fetchMatchMakerPoolVisibility,
  setMatchMakerPoolVisibility,
} from '@/services/matchmaker.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { matchmakerValuesEditHref } from '@/lib/matchmaker/valuesFormHydrate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoCreateOutline } from 'react-icons/io5';

const COMM_LABELS: Record<string, string> = {
  daily: 'Daily contact',
  few_times_week: 'A few times a week',
  flexible: 'Flexible',
};

const FAMILY_LABELS: Record<string, string> = {
  yes_want_children: 'Wants children',
  open_to_it: 'Open to children',
  no_children: 'Does not want children',
  have_open_more: 'Has children, open to more',
  have_not_open_more: 'Has children, not open to more',
};

const PACE_LABELS: Record<string, string> = {
  asap_21_days: 'Ready within about 21 days',
  one_two_months: 'One to two months',
  three_six_months: 'Three to six months',
  six_plus_months: 'Six months or more',
};

function dealbreakerSummary(raw: Record<string, unknown> | null | undefined): string {
  if (!raw || Object.keys(raw).length === 0) return 'None set';
  const parts: string[] = [];
  if (raw.faith_alignment) parts.push('Faith alignment');
  if (raw.family_goals_alignment) parts.push('Family goals');
  if (raw.max_distance_km) parts.push('Distance');
  if (raw.age_min || raw.age_max) parts.push('Age range');
  if (Array.isArray(raw.other) && raw.other.length) parts.push(`${raw.other.length} custom`);
  return parts.length ? parts.join(', ') : 'Configured';
}

function SettingsRow({
  label,
  value,
  editHref,
  editAriaLabel,
}: {
  label: string;
  value: string;
  editHref: string;
  editAriaLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0" style={{ borderColor: MATCHMAKER_THEME.border }}>
      <div className="min-w-0 flex-1 pr-2">
        <p className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.textMuted }}>
          {label}
        </p>
        <p className="mt-0.5 text-[14px] font-semibold">{value}</p>
      </div>
      <Link
        href={editHref}
        title={editAriaLabel}
        aria-label={editAriaLabel}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-primary transition hover:border-primary/35 hover:bg-[#F8F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <IoCreateOutline size={20} aria-hidden />
      </Link>
    </div>
  );
}

export function MatchMakerSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [poolBusy, setPoolBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const bundleQuery = useQuery({
    queryKey: ['matchmaker-settings-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const { data: values } = await client.from('matchmaker_values').select('*').eq('user_id', user.id).maybeSingle();
      const vis = await fetchMatchMakerPoolVisibility(client);
      return { bundle, values, poolVisible: vis.visible };
    },
    enabled: !!user?.id,
  });

  const profile = bundleQuery.data?.bundle?.profile;
  const values = bundleQuery.data?.values;
  const poolVisible = bundleQuery.data?.poolVisible ?? true;

  async function onPoolToggle(next: boolean) {
    setPoolBusy(true);
    const { error } = await setMatchMakerPoolVisibility(createClient(), next);
    setPoolBusy(false);
    if (!error) {
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-settings-bundle', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matchmaker-pool', user?.id] });
    }
  }

  async function onDeleteProfile() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleteBusy(true);
    const { error } = await deleteMatchMakerProfile(createClient());
    setDeleteBusy(false);
    if (!error) router.replace('/matchmaker');
  }

  const comm =
    COMM_LABELS[profile?.communication_style ?? ''] ??
    COMM_LABELS[values?.communication_frequency ?? ''] ??
    'Not set';

  return (
    <MatchMakerLayout>
      <MatchMakerPageShell>
        <MatchMakerPageHeader
          kicker="MatchMaker"
          title="MatchMaker Settings"
          subtitle="Private preferences for your MatchMaker experience."
          backLabel="Back"
          onBack={() => router.back()}
        />

        <FormCard className="mt-6">
          <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.accent }}>
            My Values
          </p>
          <SettingsRow
            label="Communication style"
            value={comm}
            editHref={matchmakerValuesEditHref(1, 'communication')}
            editAriaLabel="Edit communication style"
          />
          <SettingsRow
            label="Faith preference"
            value={values?.faith ? 'Set (private)' : 'Not set'}
            editHref={matchmakerValuesEditHref(1)}
            editAriaLabel="Edit faith preference"
          />
          <SettingsRow
            label="Family goals"
            value={FAMILY_LABELS[values?.family_goals ?? ''] ?? 'Not set'}
            editHref={matchmakerValuesEditHref(2)}
            editAriaLabel="Edit family goals"
          />
          <SettingsRow
            label="Pace preference"
            value={PACE_LABELS[values?.pace_preference ?? ''] ?? 'Not set'}
            editHref={matchmakerValuesEditHref(3)}
            editAriaLabel="Edit pace preference"
          />
        </FormCard>

        <FormCard className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.accent }}>
            Dealbreakers
          </p>
          <p className="mt-2 text-[14px] font-semibold">{dealbreakerSummary(values?.dealbreakers as Record<string, unknown>)}</p>
          <Link
            href={matchmakerValuesEditHref(4)}
            title="Edit dealbreakers"
            aria-label="Edit dealbreakers"
            className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-primary transition hover:border-primary/35 hover:bg-[#F8F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <IoCreateOutline size={20} aria-hidden />
          </Link>
        </FormCard>

        <FormCard className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.accent }}>
            Pool visibility
          </p>
          <ToggleRow
            label="Show me in MatchMaker pool"
            hint="When off, you are removed from the pool silently. Your values and declaration stay saved."
            checked={poolVisible}
            disabled={poolBusy}
            onChange={(v) => void onPoolToggle(v)}
          />
        </FormCard>

        <FormCard className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MATCHMAKER_THEME.accent }}>
            Account
          </p>
          <div className="mt-3">
            <MatchMakerOutlinedButton onClick={() => router.push('/matchmaker/history')}>
              Connection history
            </MatchMakerOutlinedButton>
          </div>
          <button
            type="button"
            disabled={deleteBusy}
            onClick={() => void onDeleteProfile()}
            className="mt-4 w-full text-left text-[14px] font-extrabold text-[#EF4444]"
          >
            {deleteConfirm ? (deleteBusy ? 'Deleting…' : 'Tap again to delete my MatchMaker profile') : 'Delete my MatchMaker profile'}
          </button>
          {deleteConfirm ? (
            <button
              type="button"
              className="mt-2 text-[13px] font-semibold underline"
              style={{ color: MATCHMAKER_THEME.textMuted }}
              onClick={() => setDeleteConfirm(false)}
            >
              Cancel
            </button>
          ) : null}
        </FormCard>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
