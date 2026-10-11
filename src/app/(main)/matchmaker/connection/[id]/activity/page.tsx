import { MatchMakerSharedActivity } from '@/features/matchmaker/MatchMakerSharedActivity';
import { SHARED_ACTIVITY_MAX_WEEKS } from '@/lib/matchmaker/sharedActivityCatalog';

export const metadata = { title: 'MatchMaker — Shared Activity' };

function parseWeek(raw: string | undefined): number {
  const n = Number(raw ?? '1');
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(SHARED_ACTIVITY_MAX_WEEKS, Math.floor(n));
}

export default async function MatchMakerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const weekNumber = parseWeek(sp.week);
  return <MatchMakerSharedActivity connectionId={id} weekNumber={weekNumber} />;
}
