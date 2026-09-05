import { INDEX_UPDATED_AT, STORE_ANALYSES } from "./constants";
import { PersistenceError, getDb } from "./db";
import { isListItemSafe, sortByUpdatedAtDesc } from "./safeList";
import type { SavedAnalysis } from "./types";

function store(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  onError: () => void,
): IDBObjectStore {
  const tx = db.transaction(STORE_ANALYSES, mode);
  tx.onerror = () => onError();
  tx.onabort = () => onError();
  return tx.objectStore(STORE_ANALYSES);
}

function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new PersistenceError("Local storage operation failed."));
  });
}

export async function saveAnalysis(analysis: SavedAnalysis): Promise<void> {
  const db = await getDb();
  await requestAsPromise(
    store(db, "readwrite", () => void 0).put(analysis),
  );
}

export async function getAnalysis(id: string): Promise<SavedAnalysis | null> {
  const db = await getDb();
  const result = await requestAsPromise(
    store(db, "readonly", () => void 0).get(id),
  );
  return result ?? null;
}

export async function listAnalyses(): Promise<SavedAnalysis[]> {
  const db = await getDb();
  const result = await requestAsPromise(
    store(db, "readonly", () => void 0).index(INDEX_UPDATED_AT).getAll(),
  );
  // A single corrupted/tampered record must not brick the whole list. Drop
  // only what cannot be rendered at all; sort defensively so junk timestamps
  // cannot throw. Corrupted records are never deleted here.
  const safe = (result as unknown[]).filter(isListItemSafe);
  return sortByUpdatedAtDesc(safe) as SavedAnalysis[];
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await getDb();
  await requestAsPromise(
    store(db, "readwrite", () => void 0).delete(id),
  );
}
