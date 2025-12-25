// src/core/persistStore.js
// Shared helpers that decide whether to persist data inline via localStorage
// or spill over into IndexedDB when payloads exceed safe limits.

import { namespacedKey } from "./userLocal.js";
import { kvGet, kvSet, kvDelete } from "../lib/idbKV.js";

export const IDB_MARKER = "__IDB__";
const INLINE_LIMIT = 200 * 1024; // 200KB keeps us clear of quota issues.

const isBrowser = () => typeof window !== "undefined";

export function readPersistedRaw(key) {
  if (!isBrowser()) return { source: "none", value: null };
  const ns = namespacedKey(key);
  try {
    const raw = localStorage.getItem(ns);
    if (raw === IDB_MARKER) return { source: "idb", value: null };
    if (raw == null) return { source: "none", value: null };
    return { source: "inline", value: raw };
  } catch {
    return { source: "none", value: null };
  }
}

export async function readPersistedRawFromIDB(key) {
  if (!isBrowser()) return { ok: false };
  try {
    const ns = namespacedKey(key);
    const raw = await kvGet(ns);
    if (typeof raw === "string") {
      return { ok: true, value: raw };
    }
    return { ok: false };
  } catch (err) {
    console.warn("IDB read failed", err);
    return { ok: false, error: err };
  }
}

export async function writePersistedRaw(key, raw) {
  if (!isBrowser()) return { location: "memory" };
  const ns = namespacedKey(key);
  const inlineAllowed = raw.length <= INLINE_LIMIT;
  if (inlineAllowed) {
    try {
      localStorage.setItem(ns, raw);
      await kvDelete(ns);
      return { location: "localStorage" };
    } catch (err) {
      console.warn("localStorage write failed, falling back to IndexedDB", err);
    }
  }
  await kvSet(ns, raw);
  try {
    localStorage.setItem(ns, IDB_MARKER);
  } catch {
    // ignore
  }
  return { location: "indexedDB" };
}

export async function removePersistedRaw(key) {
  if (!isBrowser()) return;
  const ns = namespacedKey(key);
  try { localStorage.removeItem(ns); } catch {}
  try { await kvDelete(ns); } catch {}
}
