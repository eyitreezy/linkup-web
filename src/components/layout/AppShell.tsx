'use client';

import { PrivacyReconsentBar } from '@/components/PrivacyReconsentBar';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { BottomNav } from '@/components/layout/BottomNav';
import { ContextPanel } from '@/components/layout/ContextPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { cn } from '@/utils/cn';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  contextTitle?: string;
  context?: ReactNode;
  /** Full-width center column (messages split-pane). */
  fullWidth?: boolean;
  /** Hide desktop right rail. */
  noContext?: boolean;
  /** Child manages its own scroll regions (inbox + chat, discover mobile swipe). */
  fixedMain?: boolean;
  /** Plan management (etc.): page owns horizontal gutters on mobile. */
  flushMobileGutter?: boolean;
  /** Subscription / pricing grids — use full center column width (no xl cap). */
  wideMain?: boolean;
};

export function AppShell({
  children,
  contextTitle,
  context,
  fullWidth,
  noContext,
  fixedMain,
  flushMobileGutter,
  wideMain,
}: Props) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (fixedMain) return;
    mainRef.current?.scrollTo(0, 0);
  }, [pathname, fixedMain]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const hasContextRail = !fullWidth && !noContext;
  const mobileGutter = flushMobileGutter
    ? 'max-lg:px-0 max-lg:py-2.5'
    : 'max-[424px]:px-2 max-[424px]:py-2.5 max-[374px]:px-1.5 max-[374px]:py-2 max-[359px]:px-1 max-[359px]:py-2';

  return (
    <div className="linkup-gradient-discovery flex h-full min-h-0 max-h-full w-full overflow-hidden">
      <Sidebar />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pl-[240px] xl:pl-[260px]">
        <TrialBanner />
        <PrivacyReconsentBar />
        <div className="flex h-full min-h-0 flex-1 overflow-hidden">
          <main
            ref={mainRef}
            className={cn(
              'h-full max-h-full min-h-0 min-w-0 flex-1',
              fixedMain ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overflow-x-hidden overscroll-y-contain',
              !fixedMain && 'max-lg:pb-[var(--linkup-bottom-nav-offset)]',
              fullWidth && 'w-full min-w-0 max-w-full overflow-x-hidden px-0 py-0'
            )}
          >
            {fullWidth || fixedMain ? (
              children
            ) : (
              <div
                className={cn(
                  'min-h-full w-full min-w-0 overflow-x-hidden px-4 py-6 md:px-6 lg:pb-0',
                  mobileGutter,
                  !hasContextRail &&
                    cn(
                      'mx-auto lg:max-w-none',
                      wideMain ? 'max-w-3xl xl:max-w-none' : 'max-w-3xl xl:max-w-4xl'
                    )
                )}
              >
                {children}
              </div>
            )}
          </main>

          {!fullWidth && !noContext ? (
            <ContextPanel title={contextTitle}>{context}</ContextPanel>
          ) : null}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
