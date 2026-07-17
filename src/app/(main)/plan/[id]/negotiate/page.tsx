import { PlanNegotiateScreen } from '@/features/plans/PlanNegotiateScreen';

export const metadata = { title: 'Manage offers' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offerId?: string; action?: string }>;
};

export default async function PlanNegotiatePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <PlanNegotiateScreen
      planId={id}
      offerId={sp.offerId ?? null}
      openAction={sp.action ?? null}
    />
  );
}
