import dynamic from 'next/dynamic';

const MatchMakerRoot = dynamic(
  () => import('@/features/matchmaker/MatchMakerRoot').then((m) => ({ default: m.MatchMakerRoot })),
  { loading: () => null }
);

export const metadata = { title: 'MatchMaker' };

export default function MatchMakerPage() {
  return <MatchMakerRoot />;
}
