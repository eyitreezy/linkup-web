import { MatchMakerConnectionScreen } from '@/features/matchmaker/MatchMakerConnectionScreen';

export const metadata = { title: 'MatchMaker — Connection' };

export default async function MatchMakerConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchMakerConnectionScreen connectionId={id} />;
}
