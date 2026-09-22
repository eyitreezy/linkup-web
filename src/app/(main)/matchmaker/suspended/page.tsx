import { MatchMakerLayout, MatchMakerPageShell } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';

export const metadata = { title: 'MatchMaker — Paused' };

export default function MatchMakerSuspendedPage() {
  return (
    <MatchMakerLayout>
      <MatchMakerPageShell className="py-16 text-center">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">MatchMaker is paused</h1>
          <p className="mt-3 text-[15px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
            MatchMaker is built for intentional connections. All other LinkUp features remain available.
          </p>
        </div>
      </MatchMakerPageShell>
    </MatchMakerLayout>
  );
}
