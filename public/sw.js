// LinkUp service worker — handles web push notifications for mood plans

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
    data = { title: 'LinkUp', body: event.data.text(), planId: null };
  }

  const { title, body, planId, imageUrl } = data;

  const options = {
    body: body ?? 'A mood meetup is happening near you.',
    icon: '/linkup-logo.png',
    badge: '/splash-icon.png',
    image: imageUrl ?? undefined,
    tag: planId ? `mood-plan-${planId}` : 'mood-plan',
    renotify: false,
    requireInteraction: false,
    data: { planId, url: planId ? `/plan/${planId}` : '/discover' },
    actions: [
      { action: 'view', title: 'View plan' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title ?? 'Mood plan near you', options)
  );
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
