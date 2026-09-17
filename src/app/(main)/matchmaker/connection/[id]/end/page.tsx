import { MatchMakerEndFlow } from '@/features/matchmaker/MatchMakerEndFlow';

export const metadata = { title: 'MatchMaker — End Connection' };

export default async function MatchMakerEndPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchMakerEndFlow connectionId={id} />;
}
