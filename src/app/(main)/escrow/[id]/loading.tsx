import { EscrowDetailSkeleton } from '@/components/escrow/EscrowDetailSkeleton';

export default function EscrowLoading() {
  return (
    <div className="px-4 pt-4 sm:px-6">
      <EscrowDetailSkeleton />
    </div>
  );
}
