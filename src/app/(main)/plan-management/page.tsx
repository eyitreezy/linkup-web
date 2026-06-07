import { PlanManagementScreen } from '@/features/plan-management/PlanManagementScreen';

export const metadata = { title: 'Plan management' };

/** Provider wraps AppShell on this route — see AppShellRouter. */
export default function PlanManagementPage() {
  return <PlanManagementScreen />;
}
