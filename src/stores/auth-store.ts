import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  loading: boolean;
  /** True while ending session — suppresses auth loader flash before hard redirect. */
  signingOut: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSigningOut: (signingOut: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signingOut: false,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setSigningOut: (signingOut) => set({ signingOut }),
}));
