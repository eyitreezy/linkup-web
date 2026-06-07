import { UserProfileScreen } from '@/features/profile/UserProfileScreen';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Profile · ${id.slice(0, 8)}` };
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  return <UserProfileScreen userId={id} />;
}
