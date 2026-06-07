'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { MessagesInboxProvider } from '@/contexts/MessagesInboxContext';
import { NotificationInboxProvider } from '@/contexts/NotificationInboxContext';
import { DiscoverForYouRail } from '@/features/discover/DiscoverForYouRail';
import { DiscoverPageProvider } from '@/features/discover/DiscoverPageContext';
import { PlanManagementPageProvider } from '@/features/plan-management/PlanManagementPageContext';
import { PlanManagementSortFilterRail } from '@/features/plan-management/PlanManagementSortFilterRail';
import { useIsMobileDiscoverLayout } from '@/hooks/use-media-query';
import { isAdminRoute } from '@/lib/navigation/navActive';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

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
  const isAdmin = isAdminRoute(pathname);

  const shell = (
    <AppShell
      fullWidth={isMessages || isAdmin}
      noContext={isMessages || isAdmin}
      fixedMain={isMessages || (isDiscover && isMobileLayout)}
      flushMobileGutter={isPlanManagement}
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
    <PresenceProvider>
      <NotificationInboxProvider>
        <MessagesInboxProvider>{content}</MessagesInboxProvider>
      </NotificationInboxProvider>
    </PresenceProvider>
  );
}
