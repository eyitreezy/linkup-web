'use client';

import { syncPendingPlanInvitations } from '@/lib/plans/planInvitations';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useRef } from 'react';

export function useSession() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const invitationSyncUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    let settled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      settled = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const timeout = window.setTimeout(() => {
      if (!settled) setLoading(false);
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      const uid = session?.user?.id ?? null;
      if (
        uid &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        invitationSyncUserIdRef.current !== uid
      ) {
        invitationSyncUserIdRef.current = uid;
        void syncPendingPlanInvitations();
      }

      if (!uid) {
        invitationSyncUserIdRef.current = null;
      }
    });

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return { user, loading };
}
