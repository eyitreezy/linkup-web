'use client';

import { isSecureWebPushContext, isWebPushSupported } from '@/lib/notifications/webPushSupport';
import { resolveVapidPublicKey } from '@/lib/notifications/vapidPublicKey';
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

export type WebPushSubscribeResult = { ok: true } | { ok: false; message?: string };

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
  const [subscribing, setSubscribing] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [vapidReady, setVapidReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const vapidPublicKeyRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    void resolveVapidPublicKey().then((key) => {
      if (cancelled) return;
      if (key) {
        vapidPublicKeyRef.current = key;
        setVapidReady(true);
      } else {
        setVapidReady(false);
      }
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
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void syncSubscriptionState();
  }, [syncSubscriptionState]);

  const subscribe = useCallback(async (): Promise<WebPushSubscribeResult> => {
    setErrorMsg(null);

    if (!vapidReady || !vapidPublicKeyRef.current) {
      const key = await resolveVapidPublicKey();
      if (!key) {
        setVapidReady(false);
        return { ok: false };
      }
      vapidPublicKeyRef.current = key;
      setVapidReady(true);
    }

    if (!user?.id) {
      return { ok: false };
    }

    if (!isWebPushSupported() || !isSecureWebPushContext()) {
      setBrowserSupported(false);
      setStatus('unsupported');
      return { ok: false };
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as WebPushStatus);
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setErrorMsg(
            'Notifications are blocked. Allow them in your browser settings for this site.'
          );
        }
        setIsSubscribed(false);
        return { ok: false };
      }

      const reg = await waitForServiceWorkerRegistration(registrationRef.current);
      registrationRef.current = reg;

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKeyRef.current) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setErrorMsg('Could not enable browser notifications. Try again.');
        return { ok: false };
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
        setErrorMsg('Could not save your notification preference. Try again.');
        setIsSubscribed(false);
        return { ok: false };
      }

      setIsSubscribed(true);
      setStatus('granted');
      setErrorMsg(null);
      return { ok: true };
    } catch (err) {
      setErrorMsg(friendlySubscribeError(err));
      setIsSubscribed(false);
      return { ok: false };
    } finally {
      setSubscribing(false);
    }
  }, [user?.id, vapidReady]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setErrorMsg(null);
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
      setErrorMsg(friendlySubscribeError(err));
    } finally {
      setSubscribing(false);
    }
  }, [user?.id]);

  return {
    status,
    isSubscribed,
    subscribing,
    browserSupported,
    vapidReady,
    subscribe,
    unsubscribe,
    errorMsg,
  };
}
