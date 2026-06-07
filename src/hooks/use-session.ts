'use client';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect } from 'react';

export function useSession() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const supabase = createClient();

    let settled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      settled = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Safety: never leave protected routes stuck on loader if getSession hangs.
    const timeout = window.setTimeout(() => {
      if (!settled) setLoading(false);
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return { user, loading };
}
