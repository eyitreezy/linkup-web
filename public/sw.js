// LinkUp service worker — web push for mood plans and chat messages

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'LinkUp', body: event.data.text() };
  }

  const type = data.type ?? (data.planId ? 'mood_plan' : data.chatId ? 'message' : 'general');
  const title = data.title ?? 'LinkUp';
  const body =
    data.body ??
    (type === 'message' ? 'You have a new message.' : 'A mood meetup is happening near you.');
  const url =
    data.url ??
    (data.chatId ? `/messages?c=${data.chatId}` : data.planId ? `/plan/${data.planId}` : '/discover');

  const tag =
    type === 'message' && data.chatId
      ? `message-${data.chatId}`
      : data.planId
        ? `mood-plan-${data.planId}`
        : 'linkup-push';

  const options = {
    body,
    icon: '/linkup-logo.png',
    badge: '/splash-icon.png',
    image: data.imageUrl ?? undefined,
    tag,
    renotify: false,
    requireInteraction: false,
    data: { type, planId: data.planId ?? null, chatId: data.chatId ?? null, url },
    actions:
      type === 'message'
        ? [
            { action: 'view', title: 'Open chat' },
            { action: 'dismiss', title: 'Dismiss' },
          ]
        : [
            { action: 'view', title: 'View plan' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/discover';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(url);
            }
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
