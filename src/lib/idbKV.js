// src/lib/idbKV.js
// Minimal IndexedDB key/value helpers used for large persistence payloads.

const DB_NAME = "quest_journal_persist";
const STORE_NAME = "kv";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

let dbPromise = null;

function openDB() {
  if (!isBrowser()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function kvGet(key) {
  if (!isBrowser()) return null;
  try {
    return await withStore("readonly", (store) => store.get(key));
  } catch {
    return null;
  }
}

export async function kvSet(key, value) {
  if (!isBrowser()) return;
  try {
    await withStore("readwrite", (store) => store.put(value, key));
  } catch (err) {
    console.warn("IndexedDB write failed", err);
  }
}

export async function kvDelete(key) {
  if (!isBrowser()) return;
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch (err) {
    console.warn("IndexedDB delete failed", err);
  }
}
