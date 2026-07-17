import { PlanAgreementScreen } from '@/features/plans/PlanAgreementScreen';

export const metadata = { title: 'Confirm plan' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offerId?: string }>;
};

export default async function PlanAgreementPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { offerId } = await searchParams;
  return <PlanAgreementScreen planId={id} offerId={offerId} />;
}
