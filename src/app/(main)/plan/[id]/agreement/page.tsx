import { PlanAgreementScreen } from '@/features/plans/PlanAgreementScreen';

export const metadata = { title: 'Agreement' };

type Props = { params: Promise<{ id: string }> };

export default async function PlanAgreementPage({ params }: Props) {
  const { id } = await params;
  return <PlanAgreementScreen planId={id} />;
}
