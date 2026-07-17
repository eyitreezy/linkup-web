'use client';

import { ADMIN_TAB_ICONS, AdminShell, type AdminTabId } from '@/features/admin/AdminShell';
import {
  AdminDisputesPanel,
  AdminMeetTypesSection,
  AdminModerationPanel,
  AdminPlansSection,
  AdminPrivacyPolicySection,
  AdminReportsPanel,
  AdminSupportPanel,
  AdminUsersSection,
  AdminVerifyPanel,
} from '@/features/admin/adminPanels';
import { useAdminDashboardRealtime } from '@/hooks/useAdminDashboardRealtime';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { parseAdminTabId } from '@/lib/admin/adminTabUrl';
import { loadAdminDashboard, type AdminDashboardData } from '@/services/admin.service';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isLoading: adminLoading, adminRecordId } = useAdminAccess();
  const initialTab = parseAdminTabId(searchParams.get('tab')) ?? 'verify';
  const [tab, setTab] = useState<AdminTabId>(initialTab);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setErr(null);
    try {
      const d = await loadAdminDashboard();
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load admin data');
    }
    if (!options?.silent) {
      setLoading(false);
    }
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.replace('/discover');
    }
  }, [adminLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  useEffect(() => {
    const fromUrl = parseAdminTabId(searchParams.get('tab'));
    if (fromUrl && fromUrl !== tab) {
      setTab(fromUrl);
    }
  }, [searchParams, tab]);

  const handleTabChange = useCallback(
    (next: AdminTabId) => {
      setTab(next);
      router.replace(`/admin?tab=${next}`, { scroll: false });
    },
    [router]
  );

  useAdminDashboardRealtime(
    useCallback(() => {
      void loadRef.current({ silent: true });
    }, []),
    isAdmin
  );

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      kycPending: data.ver.filter((x) => x.status === 'pending').length,
      reportsPending: data.reports.filter((x) => x.status === 'pending').length,
      disputesOpen: data.planDisputes.filter((x) => x.status === 'pending' || x.status === 'reviewing').length,
      modHigh: data.mods.filter((x) => x.severity === 'high').length,
      escrowOpen: data.escrowDisputes.filter((x) => {
        const s = x.status.toLowerCase();
        return s === 'open' || s === 'under_review';
      }).length,
      ticketsOpen: data.tickets.filter((x) => {
        const s = x.status.toLowerCase();
        return s === 'open' || s === 'in_progress';
      }).length,
    };
  }, [data]);

  const adminTabs = useMemo(
    () =>
      [
        { id: 'verify' as const, label: 'KYC', badge: stats?.kycPending, icon: ADMIN_TAB_ICONS.verify },
        { id: 'reports' as const, label: 'Reports', badge: stats?.reportsPending, icon: ADMIN_TAB_ICONS.reports },
        { id: 'moderation' as const, label: 'Moderation', badge: stats?.modHigh, icon: ADMIN_TAB_ICONS.moderation },
        {
          id: 'plan_disputes' as const,
          label: 'Disputes',
          badge: (stats?.disputesOpen ?? 0) + (stats?.escrowOpen ?? 0),
          icon: ADMIN_TAB_ICONS.plan_disputes,
        },
        { id: 'support' as const, label: 'Support', badge: stats?.ticketsOpen, icon: ADMIN_TAB_ICONS.support },
        { id: 'users' as const, label: 'Users', icon: ADMIN_TAB_ICONS.users },
        { id: 'plans' as const, label: 'Plans', icon: ADMIN_TAB_ICONS.plans },
        {
          id: 'privacy_policy' as const,
          label: 'Privacy',
          icon: ADMIN_TAB_ICONS.privacy_policy,
        },
        { id: 'meet_types' as const, label: 'Meet types', icon: ADMIN_TAB_ICONS.meet_types },
      ],
    [stats]
  );

  const statCards = useMemo(
    () =>
      stats
        ? [
            { label: 'KYC', value: stats.kycPending },
            { label: 'Reports', value: stats.reportsPending },
            { label: 'Disputes', value: stats.disputesOpen },
            { label: 'High mod', value: stats.modHigh },
            { label: 'Escrow', value: stats.escrowOpen },
            { label: 'Tickets', value: stats.ticketsOpen },
          ]
        : null,
    [stats]
  );

  if (adminLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <p className="text-[14px] font-semibold text-muted">
          {adminLoading ? 'Checking admin access…' : 'Redirecting…'}
        </p>
      </div>
    );
  }

  return (
    <div className="linkup-page-shell min-w-0 max-w-full">
    <AdminShell
      tab={tab}
      onTabChange={handleTabChange}
      tabs={adminTabs}
      stats={statCards}
      onRefresh={() => void load()}
      refreshing={loading}
    >
      {err ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {err}
        </p>
      ) : null}
      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[22px] bg-[#EDE8FF]/70" />
          ))}
        </div>
      ) : null}
      {data && tab === 'verify' ? (
        <AdminVerifyPanel data={data} adminRecordId={adminRecordId} onReload={() => void load()} />
      ) : null}
      {data && tab === 'reports' ? <AdminReportsPanel data={data} onReload={() => void load()} /> : null}
      {data && tab === 'moderation' ? <AdminModerationPanel data={data} /> : null}
      {data && tab === 'plan_disputes' ? (
        <AdminDisputesPanel data={data} onReload={() => void load()} />
      ) : null}
      {data && tab === 'support' ? <AdminSupportPanel data={data} onReload={() => void load()} /> : null}
      {tab === 'users' ? <AdminUsersSection /> : null}
      {tab === 'plans' ? <AdminPlansSection /> : null}
      {tab === 'privacy_policy' ? <AdminPrivacyPolicySection /> : null}
      {tab === 'meet_types' ? <AdminMeetTypesSection /> : null}
    </AdminShell>
    </div>
  );
}
