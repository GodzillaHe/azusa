import type { ImageCount, ImageQuality, ImageSize, ImageStyle } from "./image-options";

export const MAX_HISTORY_RECORDS = 50;

const DB_NAME = "image-generator-history";
const DB_VERSION = 1;
const STORE_NAME = "records";

export type HistoryRecord = {
  id: string;
  prompt: string;
  mode: "generate" | "edit";
  size: ImageSize;
  count: ImageCount;
  quality: ImageQuality;
  style: ImageStyle;
  createdAt: string;
  images: string[];
};

function requireIndexedDB(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available.");
  }

  return indexedDB;
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = requireIndexedDB().open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open history database."));
  });
}

function runStoreOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openHistoryDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);
        let result: T;

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(request.error ?? new Error("History database operation failed."));
        transaction.onerror = () => reject(transaction.error ?? new Error("History transaction failed."));
        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("History transaction aborted."));
        };
      }),
  );
}

export function trimHistoryRecords(records: HistoryRecord[]): HistoryRecord[] {
  return [...records]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_HISTORY_RECORDS);
}

export function getHistoryRecordIdsToDelete(records: HistoryRecord[]): string[] {
  const keepIds = new Set(trimHistoryRecords(records).map((record) => record.id));

  return [...records]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((record) => !keepIds.has(record.id))
    .map((record) => record.id);
}

export async function listHistoryRecords(): Promise<HistoryRecord[]> {
  const records = await runStoreOperation<HistoryRecord[]>("readonly", (store) => store.getAll());

  return trimHistoryRecords(records);
}

export async function saveHistoryRecord(record: HistoryRecord): Promise<void> {
  await runStoreOperation<IDBValidKey>("readwrite", (store) => store.put(record));
  await trimStoredHistoryRecords();
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  await runStoreOperation<undefined>("readwrite", (store) => store.delete(id));
}

export async function clearHistoryRecords(): Promise<void> {
  await runStoreOperation<undefined>("readwrite", (store) => store.clear());
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return null;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

async function trimStoredHistoryRecords(): Promise<void> {
  const records = await runStoreOperation<HistoryRecord[]>("readonly", (store) => store.getAll());
  const idsToDelete = new Set(getHistoryRecordIdsToDelete(records));

  if (idsToDelete.size === 0) {
    return;
  }

  const db = await openHistoryDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      const record = cursor.value as HistoryRecord;

      if (idsToDelete.has(record.id)) {
        cursor.delete();
      }

      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to trim history records."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to trim history records."));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("History trim transaction aborted."));
    };
  });
}
