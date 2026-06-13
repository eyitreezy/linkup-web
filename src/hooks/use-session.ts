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
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return { user, loading };
}
