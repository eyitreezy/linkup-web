'use client';

import { AppShellRouter } from '@/components/layout/AppShellRouter';
import { SubscriptionProvider } from '@/lib/subscription/SubscriptionContext';
import { useSession } from '@/hooks/use-session';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

function AppViewport({ children }: { children: ReactNode }) {
  return <div className="h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden">{children}</div>;
}
import { AuthRouteLoader } from '@/components/auth/AuthRouteLoader';

type Props = {
  children: ReactNode;
  /** User resolved on the server for this request (middleware already guards routes). */
  initialUser: User | null;
};

/**
 * Restores Supabase session on the client and gates (main) routes until auth is known.
 * Server `initialUser` prevents the "Sign in to…" flash on hard reload.
 */
export function AuthMainLayout({ children, initialUser }: Props) {
  useSession();

  const storeUser = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const pathname = usePathname();
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    if (!loading) setClientReady(true);
  }, [loading]);

  // Align client store with server snapshot when the client store is still empty.
  useEffect(() => {
    if (initialUser && !storeUser) {
      setUser(initialUser);
    }
  }, [initialUser, storeUser, setUser]);

  // Use server user only until the client finishes its first session read.
  const resolvedUser = clientReady ? storeUser : (storeUser ?? initialUser);
  const isResolving = !clientReady && resolvedUser == null;

  useEffect(() => {
    if (isResolving || resolvedUser) return;
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isResolving, resolvedUser, pathname, router]);

  if (isResolving) {
    return (
      <AppViewport>
        <AuthRouteLoader variant="shell" />
      </AppViewport>
    );
  }

  if (!resolvedUser) {
    return (
      <AppViewport>
        <AuthRouteLoader variant="redirect" />
      </AppViewport>
    );
  }

  return (
    <AppViewport>
      <SubscriptionProvider>
        <AppShellRouter>{children}</AppShellRouter>
      </SubscriptionProvider>
    </AppViewport>
  );
}
