import dynamic from 'next/dynamic';

const CreatePlanScreen = dynamic(
  () => import('@/features/plans/CreatePlanScreen').then((m) => ({ default: m.CreatePlanScreen })),
  { loading: () => null }
);

export const metadata = { title: 'Create plan' };

export default function CreatePlanPage() {
  return <CreatePlanScreen />;
}
