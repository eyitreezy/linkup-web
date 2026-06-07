'use client';

import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Hydration-safe auth status. Pass `initialUser` from the server on first paint
 * so protected routes never flash "Sign in" while the client restores the session.
 */
export function useAuthStatus(initialUser?: User | null): {
  status: AuthStatus;
  user: User | null;
} {
  const storeUser = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  const user = storeUser ?? initialUser ?? null;

  if (loading && user == null) {
    return { status: 'loading', user: null };
  }

  if (user) {
    return { status: 'authenticated', user };
  }

  return { status: 'unauthenticated', user: null };
}
