'use client';

import { MatchMakerLayout, MatchMakerPrimaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useRouter } from 'next/navigation';

export function MatchMakerHeal() {
  const router = useRouter();

  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold">A moment to refine</h1>
        <p className="mt-3 text-[14px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          Before you return to MatchMaker, take a moment to update what matters to you.
        </p>
        <p className="mt-8 text-[14px] font-semibold">
          Healing questionnaire (Phase 2), placeholder for paginated 5-question flow.
        </p>
        <div className="mt-8">
          <MatchMakerPrimaryButton onClick={() => router.push('/matchmaker/reentry')}>
            Continue
          </MatchMakerPrimaryButton>
        </div>
      </div>
    </MatchMakerLayout>
  );
}
