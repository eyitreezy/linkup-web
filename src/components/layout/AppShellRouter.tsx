'use client';

import { AppShell } from '@/components/layout/AppShell';
import { UpgradeGateProvider } from '@/contexts/UpgradeGateContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { MessagesInboxProvider } from '@/contexts/MessagesInboxContext';
import { NotificationInboxProvider } from '@/contexts/NotificationInboxContext';
import { DiscoverPageProvider } from '@/features/discover/DiscoverPageContext';
import { PlanManagementPageProvider } from '@/features/plan-management/PlanManagementPageContext';
import { useIsMobileDiscoverLayout } from '@/hooks/use-media-query';
import { isAdminRoute } from '@/lib/navigation/navActive';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const DiscoverForYouRail = dynamic(
  () => import('@/features/discover/DiscoverForYouRail').then((m) => ({ default: m.DiscoverForYouRail })),
  { loading: () => <div className="animate-pulse space-y-3 p-1" aria-hidden><div className="h-24 rounded-2xl bg-[#EDE8FF]/70" /></div> }
);

const PlanManagementSortFilterRail = dynamic(
  () =>
    import('@/features/plan-management/PlanManagementSortFilterRail').then((m) => ({
      default: m.PlanManagementSortFilterRail,
    })),
  { loading: () => <div className="animate-pulse space-y-3 p-1" aria-hidden><div className="h-24 rounded-2xl bg-[#EDE8FF]/70" /></div> }
);

export function AppShellRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMobileLayout = useIsMobileDiscoverLayout();
  const isMessages =
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname.startsWith('/chat/');
  const isDiscover = pathname === '/discover' || pathname.startsWith('/discover/');
  const isPlanManagement =
    pathname === '/plan-management' || pathname.startsWith('/plan-management/');
  const isSubscription =
    pathname === '/subscription' || pathname.startsWith('/subscription/');
  const isAdmin = isAdminRoute(pathname);
  const isPlanMeetupFlow =
    pathname.startsWith('/plan/') && pathname !== '/plan/create';

  const shell = (
    <AppShell
      fullWidth={isMessages || isAdmin}
      noContext={isMessages || isAdmin || isSubscription}
      wideMain={isSubscription}
      fixedMain={isMessages || (isDiscover && isMobileLayout)}
      flushMobileGutter={isPlanManagement}
      alignMainStart={isPlanMeetupFlow}
      contextTitle={isDiscover || isPlanManagement ? 'Sort and filter' : undefined}
      context={
        isDiscover ? (
          <DiscoverForYouRail />
        ) : isPlanManagement ? (
          <PlanManagementSortFilterRail />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );

  let content = shell;

  if (isDiscover) {
    content = <DiscoverPageProvider>{shell}</DiscoverPageProvider>;
  } else if (isPlanManagement) {
    content = <PlanManagementPageProvider>{shell}</PlanManagementPageProvider>;
  }

  return (
    <UpgradeGateProvider>
      <PresenceProvider>
        <NotificationInboxProvider>
          <MessagesInboxProvider>{content}</MessagesInboxProvider>
        </NotificationInboxProvider>
      </PresenceProvider>
    </UpgradeGateProvider>
  );
}
