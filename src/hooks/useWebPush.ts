'use client';

import { isSecureWebPushContext, isWebPushSupported } from '@/lib/notifications/webPushSupport';
import {
  getCachedVapidPublicKey,
  isVapidPublicKeyConfigured,
  resolveVapidPublicKey,
} from '@/lib/notifications/vapidPublicKey';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useCallback, useEffect, useRef, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type WebPushStatus = 'unsupported' | 'denied' | 'granted' | 'default' | 'loading';

export type WebPushSubscribeResult =
  | { ok: true }
  | { ok: false; message: string };

function friendlySubscribeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Could not enable browser notifications. Try again or check site permissions.';
}

async function waitForServiceWorkerRegistration(
  existing: ServiceWorkerRegistration | null
): Promise<ServiceWorkerRegistration> {
  if (existing?.active) return existing;
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

export function useWebPush() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<WebPushStatus>('loading');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [vapidConfigured, setVapidConfigured] = useState(isVapidPublicKeyConfigured());
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveVapidPublicKey().then((key) => {
      if (!cancelled) setVapidConfigured(!!key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncSubscriptionState = useCallback(async () => {
    if (!isWebPushSupported()) {
      setBrowserSupported(false);
      setStatus('unsupported');
      setIsSubscribed(false);
      return;
    }

    if (!isSecureWebPushContext()) {
      setBrowserSupported(false);
      setStatus('unsupported');
      setLastError('Browser notifications require HTTPS or localhost.');
      setIsSubscribed(false);
      return;
    }

    setBrowserSupported(true);
    setStatus(Notification.permission as WebPushStatus);

    try {
      const reg = await waitForServiceWorkerRegistration(registrationRef.current);
      registrationRef.current = reg;
      const existing = await reg.pushManager.getSubscription();
      setIsSubscribed(!!existing);
      if (existing && Notification.permission === 'granted') {
        setStatus('granted');
      }
    } catch (err) {
      setIsSubscribed(false);
      setLastError(friendlySubscribeError(err));
    }
  }, []);

  useEffect(() => {
    void syncSubscriptionState();
  }, [syncSubscriptionState]);

  const subscribe = useCallback(async (): Promise<WebPushSubscribeResult> => {
    setLastError(null);

    if (!user?.id) {
      const message = 'Sign in to enable mood plan alerts.';
      setLastError(message);
      return { ok: false, message };
    }

    const vapidPublicKey = await resolveVapidPublicKey();
    if (!vapidPublicKey) {
      const message =
        'Push is not configured on this site yet (missing VAPID public key). Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to .env.local, restart the dev server, or set it on Vercel and redeploy.';
      setLastError(message);
      setVapidConfigured(false);
      return { ok: false, message };
    }
    setVapidConfigured(true);

    if (!isWebPushSupported()) {
      const message = 'Browser push is not supported on this device.';
      setLastError(message);
      setStatus('unsupported');
      setBrowserSupported(false);
      return { ok: false, message };
    }

    if (!isSecureWebPushContext()) {
      const message = 'Browser notifications require HTTPS or localhost.';
      setLastError(message);
      return { ok: false, message };
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as WebPushStatus);
      if (permission !== 'granted') {
        const message =
          permission === 'denied'
            ? 'Notifications are blocked. Allow them in your browser settings for this site.'
            : 'Notification permission was not granted.';
        setLastError(message);
        setIsSubscribed(false);
        return { ok: false, message };
      }

      const reg = await waitForServiceWorkerRegistration(registrationRef.current);
      registrationRef.current = reg;

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        const message = 'Browser did not return a valid push subscription.';
        setLastError(message);
        return { ok: false, message };
      }

      const client = createClient();
      const { error: upsertErr } = await client.from('web_push_subscriptions').upsert(
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

      if (upsertErr) {
        const message = upsertErr.message.includes('web_push_subscriptions')
          ? 'Push storage is not set up yet. Apply the web_push_subscriptions migration in Supabase.'
          : upsertErr.message;
        setLastError(message);
        setIsSubscribed(false);
        return { ok: false, message };
      }

      setIsSubscribed(true);
      setStatus('granted');
      return { ok: true };
    } catch (err) {
      const message = friendlySubscribeError(err);
      setLastError(message);
      setIsSubscribed(false);
      return { ok: false, message };
    } finally {
      setSubscribing(false);
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setLastError(null);
    if (!user?.id) return;
    setSubscribing(true);
    try {
      const reg = await waitForServiceWorkerRegistration(registrationRef.current);
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
      setIsSubscribed(false);
      setStatus(Notification.permission as WebPushStatus);
    } catch (err) {
      setLastError(friendlySubscribeError(err));
    } finally {
      setSubscribing(false);
    }
  }, [user?.id]);

  return {
    status,
    isSubscribed,
    subscribing,
    lastError,
    browserSupported,
    vapidConfigured: vapidConfigured || isVapidPublicKeyConfigured(),
    subscribe,
    unsubscribe,
    clearError: () => setLastError(null),
  };
}
