import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { Suspense } from 'react';

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-[14px] font-semibold text-muted">Loading admin…</p>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
