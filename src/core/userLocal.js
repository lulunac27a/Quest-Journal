// src/core/userLocal.js
// Per-user localStorage helpers with safe fallback to non-namespaced keys.
// This avoids cross-account data leakage while preserving legacy data.

import * as Sync from "../sync/index.js";

// Resolve the current UID early and robustly.
// Priority:
// 1) Live sync user (after init/onAuthStateChanged)
// 2) Last known UID (even if signed out)
// 3) Empty string
function currentUid() {
  try {
    const live = (Sync.getUser?.() || {}).uid || "";
    if (live) return live;
  } catch {}
  try {
    const last = Sync.getLastUid?.();
    if (last) return last;
  } catch {}
  return "";
}

export function namespacedKey(base) {
  const uid = currentUid();
  return uid ? `qj::${uid}::${base}` : base;
}

export function getItem(baseKey) {
  try {
    const uid = currentUid();
    const key = namespacedKey(baseKey);
    const v = localStorage.getItem(key);
    if (v != null) return v;
    // Only fall back to legacy, non-namespaced keys when no user is signed in.
    // This prevents leaking another account's local data into a signed-in session.
    if (!uid) return localStorage.getItem(baseKey);
    return null;
  } catch { return null; }
}

export function setItem(baseKey, value) {
  try { localStorage.setItem(namespacedKey(baseKey), value); } catch {}
}

export function removeItem(baseKey) {
  try { localStorage.removeItem(namespacedKey(baseKey)); } catch {}
  try { localStorage.removeItem(baseKey); } catch {}
}

export function getJSON(baseKey, fallback) {
  try {
    const raw = getItem(baseKey);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

export function setJSON(baseKey, obj) {
  try { setItem(baseKey, JSON.stringify(obj)); } catch {}
}

// Remove all keys for current user's namespace (qj::<uid>::*)
export function removeAllForCurrentUser() {
  const uid = currentUid();
  if (!uid) return;
  const nsPrefix = `qj::${uid}::`;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(nsPrefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
}
