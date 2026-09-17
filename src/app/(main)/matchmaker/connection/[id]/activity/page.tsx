import { MatchMakerSharedActivity } from '@/features/matchmaker/MatchMakerSharedActivity';

export const metadata = { title: 'MatchMaker — Shared Activity' };

export default async function MatchMakerActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchMakerSharedActivity connectionId={id} />;
}
