import type { QuickAddCreateInput } from "./preview-model";

// antrean quick-add saat offline (PRD 8, ARCHITECTURE 9); clientId yang sama membuat kiriman ulang tidak dobel
const DB_NAME = "kaskita-offline";
const STORE = "quick-add";

export interface QueuedQuickAdd {
  clientId: string;
  input: QuickAddCreateInput;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function offlineQueueAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueueQuickAdd(inputs: QuickAddCreateInput[]): Promise<void> {
  const queuedAt = Date.now();
  await withStore("readwrite", (store) => {
    for (const input of inputs) store.put({ clientId: input.clientId, input, queuedAt } satisfies QueuedQuickAdd);
  });
}

export async function listQueuedQuickAdds(): Promise<QueuedQuickAdd[]> {
  const rows = await withStore<QueuedQuickAdd[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedQuickAdd[]>);
  return (rows ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeQueuedQuickAdds(clientIds: string[]): Promise<void> {
  await withStore("readwrite", (store) => {
    for (const id of clientIds) store.delete(id);
  });
}
