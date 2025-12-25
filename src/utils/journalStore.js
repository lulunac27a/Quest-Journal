// ذخیره‌سازی جورنال: متن/متادیتا در localStorage، تصویر در IndexedDB
import { getJSON as getJSONu, setJSON as setJSONu, namespacedKey } from "../core/userLocal.js";

const LSK = "qj_journal_entries_v1"; // per-user via userLocal
const BASE_DB_NAME = "qj_journal_db";
function currentDBName() {
  // Derive DB name from namespacedKey to isolate per-user blobs
  const scoped = namespacedKey(BASE_DB_NAME);
  return scoped === BASE_DB_NAME ? BASE_DB_NAME : scoped.replaceAll(":", "_");
}
const STORE = "images";

// ---------- LocalStorage: entries ----------
export function loadEntry(id) {
  try {
    const map = getJSONu(LSK, {});
    return map[id] || null;
  } catch { return null; }
}
export function loadAllEntries() {
  try { return getJSONu(LSK, {}) || {}; } catch { return {}; }
}
export function saveAllEntries(map) {
  try { setJSONu(LSK, map || {}); } catch {}
}
export function saveEntry(entry) {
  const { id } = entry || {};
  if (!id) return;
  const map = getJSONu(LSK, {});
  map[id] = entry;
  setJSONu(LSK, map);
}
export function listRecent(n = 10) {
  try {
    const map = getJSONu(LSK, {});
    const arr = Object.values(map).sort((a,b)=> (b.dateISO||"").localeCompare(a.dateISO||""));
    return arr.slice(0, n).map(e => ({ id: e.id, dateISO: e.dateISO, thumb: e.thumb || null, title: e.title || "" }));
  } catch { return []; }
}

// ---------- IndexedDB: small wrapper ----------
function withStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(currentDBName(), 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      fn(store, tx);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}
function idbGet(key) {
  return new Promise((resolve, reject) => {
    withStore("readonly", (store) => {
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    }).catch(reject);
  });
}
function idbPut(key, val) {
  return new Promise((resolve, reject) => {
    withStore("readwrite", (store) => {
      const r = store.put(val, key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }).catch(reject);
  });
}

// ---------- Image helpers ----------
export async function saveImageDataURL(id, dataURL) {
  if (!id || !dataURL) return;
  // ذخیره‌ی thumbnail کوچک داخل entry برای لیست
  const thumb = await makeThumb(dataURL, 120);
  const entry = loadEntry(id) || { id, dateISO: new Date().toISOString() };
  entry.thumb = thumb;
  saveEntry(entry);

  // ذخیره‌ی Blob در IDB
  const blob = await (await fetch(dataURL)).blob();
  await idbPut(id, blob);
}
export async function getImageURL(id) {
  const blob = await idbGet(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deleteJournalDB() {
  try {
    const name = currentDBName();
    const req = indexedDB.deleteDatabase(name);
    await new Promise((resolve) => {
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch {}
}

// کوچک‌کننده‌ی DataURL برای thumbnail
async function makeThumb(dataURL, size=120) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(size, size);
      const ratio = Math.min(s/img.width, s/img.height);
      c.width = Math.round(img.width*ratio);
      c.height = Math.round(img.height*ratio);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}
