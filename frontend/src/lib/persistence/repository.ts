import { INDEX_UPDATED_AT, STORE_ANALYSES } from "./constants";
import { PersistenceError, getDb } from "./db";
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
  return (result as SavedAnalysis[]).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await getDb();
  await requestAsPromise(
    store(db, "readwrite", () => void 0).delete(id),
  );
}
