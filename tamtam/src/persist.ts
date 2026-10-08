// Tiny IndexedDB wrapper. Stores the autosave, saved inventions (with thumbnails). Never stores camera data.
const DB = 'tamtam';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function kvSet(key: string, value: unknown) {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch { /* private mode etc: game still works */ }
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    const v = await new Promise<T | undefined>((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result as T | undefined);
      q.onerror = () => rej(q.error);
    });
    db.close();
    return v;
  } catch { return undefined; }
}

export async function kvClear() {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch { /* ignore */ }
}
