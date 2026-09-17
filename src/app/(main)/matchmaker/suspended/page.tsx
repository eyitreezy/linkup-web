import { MatchMakerLayout } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';

export const metadata = { title: 'MatchMaker — Paused' };

export default function MatchMakerSuspendedPage() {
  return (
    <MatchMakerLayout>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">MatchMaker is paused</h1>
        <p className="mt-3 text-[15px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
          MatchMaker is built for intentional connections. All other LinkUp features remain available.
        </p>
      </div>
    </MatchMakerLayout>
  );
}
