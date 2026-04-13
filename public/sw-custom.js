// Custom service worker additions (merged with next-pwa/workbox generated SW)
// This file handles: push notifications + background sync for task confirms.

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Onatuchi', body: event.data.text(), url: '/' };
  }

  const title = data.title ?? 'Onatuchi Cattery Manager';
  const options = {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url ?? '/' },
    tag: data.tag ?? 'general',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background Sync for offline task confirmations ─────────────────────────

const SYNC_TAG = 'task-confirms';

// Store pending confirms in IndexedDB
const DB_NAME = 'cattery-sync';
const STORE = 'pending-actions';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function clearActions(db, ids) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushPendingActions());
  }
});

async function flushPendingActions() {
  const db = await openDb();
  const actions = await getPendingActions(db);
  if (!actions.length) return;

  const res = await fetch('/api/sync/flush', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actions: actions.map(({ id, ...rest }) => rest) })
  });

  if (res.ok) {
    await clearActions(db, actions.map((a) => a.id));
  }
}
