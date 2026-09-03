import {
  DB_NAME,
  DB_VERSION,
  INDEX_UPDATED_AT,
  STORE_ANALYSES,
} from "./constants";

// Browser-only IndexedDB connection. Accessed through functions in this module
// that are only ever called from client event handlers / effects, never during
// server rendering or module evaluation.

export class PersistenceError extends Error {}

export function indexedDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!indexedDBAvailable()) {
    return Promise.reject(new PersistenceError("IndexedDB is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ANALYSES)) {
        const store = db.createObjectStore(STORE_ANALYSES, { keyPath: "id" });
        store.createIndex(INDEX_UPDATED_AT, INDEX_UPDATED_AT);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new PersistenceError("Could not open local storage on this device."));
    request.onblocked = () =>
      reject(new PersistenceError("Local storage is blocked by another tab."));
  });
}

export function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}
