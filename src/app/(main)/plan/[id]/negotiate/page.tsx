import { PlanNegotiateScreen } from '@/features/plans/PlanNegotiateScreen';

export const metadata = { title: 'Manage offers' };

type Props = { params: Promise<{ id: string }> };

export default async function PlanNegotiatePage({ params }: Props) {
  const { id } = await params;
  return <PlanNegotiateScreen planId={id} />;
}
