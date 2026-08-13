'use client';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useCallback, useEffect, useRef, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type WebPushStatus = 'unsupported' | 'denied' | 'granted' | 'default' | 'loading';

export function useWebPush() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<WebPushStatus>('loading');
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission as WebPushStatus);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        registrationRef.current = reg;
      })
      .catch(() => setStatus('unsupported'));
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !VAPID_PUBLIC_KEY) return false;

    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as WebPushStatus);
      if (permission !== 'granted') return false;

      const reg = registrationRef.current ?? (await navigator.serviceWorker.ready);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

      const client = createClient();
      await client.from('web_push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

      return true;
    } catch {
      return false;
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    try {
      const reg = registrationRef.current ?? (await navigator.serviceWorker.ready);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const client = createClient();
        await client
          .from('web_push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      }
    } catch {
      /* ignore */
    }
    setStatus('default');
  }, [user?.id]);

  return { status, subscribe, unsubscribe };
}
