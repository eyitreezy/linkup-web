import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export const metadata = { title: 'Set up profile' };

type Props = {
  searchParams: Promise<{ invitation_token?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <OnboardingScreen invitationToken={sp.invitation_token ?? null} />;
}
