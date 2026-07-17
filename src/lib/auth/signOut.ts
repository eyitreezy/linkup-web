import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { QueryClient } from '@tanstack/react-query';

type SignOutOptions = {
  queryClient?: QueryClient;
  /** Full navigation clears SSR auth cookies + server `initialUser` snapshot. */
  redirectTo?: string;
};

/**
 * End the Supabase session, clear client auth state, and hard-redirect to login.
 */
export async function signOutAndRedirect(options: SignOutOptions = {}) {
  const { queryClient, redirectTo = '/login' } = options;

  // Set before async work so AuthMainLayout never shows the session-restore loader.
  useAuthStore.getState().setSigningOut(true);

  const client = createClient();
  const { error } = await client.auth.signOut();

  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[auth] signOut:', error.message);
  }

  if (typeof window !== 'undefined') {
    // Hard navigation resets client state; avoid clearing the store first (causes loader flash).
    window.location.replace(redirectTo);
    return;
  }

  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setSigningOut(false);
  queryClient?.clear();
}
