'use client';

import {
  setOfflinePresence,
  updateTypingTarget,
  upsertOnlineHeartbeat,
} from '@/lib/presence/presenceHeartbeat';
import { getVisibilityPrefs } from '@/lib/presence/visibilityPrefs';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

const HEARTBEAT_MS = 45_000;
const TYPING_DEBOUNCE_MS = 320;
const TYPING_IDLE_CLEAR_MS = 2_600;

type Ctx = {
  signalTyping: (conversationId: string) => void;
  clearTyping: () => void;
};

const PresenceCtx = createContext<Ctx | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const uid = user?.id ?? null;
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBeatRef = useRef(0);

  const { data: bundle } = useQuery({
    queryKey: ['profile-bundle', uid],
    queryFn: async () => {
      if (!uid) return null;
      return fetchUserProfileBundle(createClient(), uid);
    },
    enabled: !!uid,
    staleTime: 60_000,
  });
  const profile = bundle?.profile ?? null;

  const runHeartbeat = useCallback(async () => {
    if (!uid) return;
    const now = Date.now();
    if (now - lastBeatRef.current < 25_000) return;
    lastBeatRef.current = now;
    try {
      await upsertOnlineHeartbeat(uid);
    } catch {
      /* offline / RLS */
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    lastBeatRef.current = 0;
    void upsertOnlineHeartbeat(uid);
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void runHeartbeat();
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [uid, runHeartbeat]);

  useEffect(() => {
    if (!uid || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        lastBeatRef.current = 0;
        void upsertOnlineHeartbeat(uid);
      } else {
        void setOfflinePresence(uid);
        void updateTypingTarget(uid, null);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [uid]);

  const clearTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingTimerRef.current = null;
    typingIdleRef.current = null;
    if (!uid) return;
    const v = getVisibilityPrefs(profile);
    if (!v.share_typing_indicator) return;
    void updateTypingTarget(uid, null);
  }, [uid, profile]);

  const signalTyping = useCallback(
    (conversationId: string) => {
      if (!uid) return;
      const v = getVisibilityPrefs(profile);
      if (!v.share_typing_indicator) return;

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        void updateTypingTarget(uid, conversationId);
      }, TYPING_DEBOUNCE_MS);

      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      typingIdleRef.current = setTimeout(() => {
        void updateTypingTarget(uid, null);
      }, TYPING_IDLE_CLEAR_MS);
    },
    [uid, profile]
  );

  useEffect(() => {
    const u = uid;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (u) {
        void setOfflinePresence(u);
        void updateTypingTarget(u, null);
      }
    };
  }, [uid]);

  const value = useMemo(() => ({ signalTyping, clearTyping }), [signalTyping, clearTyping]);

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceCtx);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
}

export function usePresenceOptional() {
  return useContext(PresenceCtx);
}
