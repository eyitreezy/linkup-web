import { MatchMakerProfileScreen } from '@/features/matchmaker/MatchMakerProfileScreen';

export const metadata = { title: 'MatchMaker — Profile' };

export default async function MatchMakerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <MatchMakerProfileScreen userId={userId} />;
}
