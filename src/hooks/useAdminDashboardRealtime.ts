'use client';

import { subscribePostgresRealtime } from '@/lib/realtime/subscribePostgresRealtime';
import { useEffect } from 'react';

const ADMIN_QUEUE_TABLES = [
  'verification_requests',
  'reports',
  'moderation_logs',
  'disputes',
  'escrow_disputes',
  'support_tickets',
  'plans',
] as const;

/** Silent reload for admin dashboard queue tabs (KYC, reports, disputes, support, etc.). */
export function useAdminDashboardRealtime(onReload: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return subscribePostgresRealtime(
      onReload,
      ADMIN_QUEUE_TABLES.map((table) => ({ table })),
      { channelPrefix: 'admin-dashboard-rt' }
    );
  }, [onReload, enabled]);
}
