'use client';

const DB_NAME = 'cattery-sync';
const STORE = 'pending-actions';
const SYNC_TAG = 'task-confirms';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function queueAction(action: string, payload: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ action, payload });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

// Confirm a medication task. If online, POST directly. If offline, queue for background sync.
export async function confirmTaskWithFallback(taskId: string): Promise<{ ok: boolean; queued?: boolean }> {
  if (navigator.onLine) {
    const r = await fetch(`/api/tasks/${taskId}/confirm`, { method: 'POST' });
    return { ok: r.ok };
  }

  // Offline — queue and register background sync
  await queueAction('confirm_task', { task_id: taskId });

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(SYNC_TAG);
  }

  return { ok: true, queued: true };
}
