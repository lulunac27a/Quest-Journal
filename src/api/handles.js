// src/api/handles.js
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

export function sanitizeHandle(raw) {
  const s = (raw || "").trim();
  // Allow only [a-z0-9_], case-insensitive; enforce lower for key
  const cleaned = s.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned;
}

export function validateHandle(raw) {
  const s = sanitizeHandle(raw);
  if (s.length < 3 || s.length > 20) return { ok: false, reason: "length" };
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return { ok: false, reason: "format" };
  return { ok: true, value: s };
}

export async function isAvailable(handle) {
  const clean = sanitizeHandle(handle);
  if (!clean) return { available: false, reason: "empty" };
  const lower = clean.toLowerCase();
  const ref = doc(db, "handles", lower);
  const snap = await getDoc(ref);
  return { available: !snap.exists(), owner: snap.exists() ? (snap.data()?.uid || null) : null };
}

/**
 * Reserve a handle for the given uid.
 * - Creates/updates `profiles/{uid}` with { handle, handleLower }
 * - Creates `handles/{lower}` with { uid, original, createdAt }
 * - If user had an old handle, attempts to release it if owned by the same uid
 */
export async function claimHandle(uid, desired) {
  const v = validateHandle(desired);
  if (!v.ok) throw new Error(v.reason === "length" ? "Handle must be 3–20 chars" : "Invalid handle");
  const original = v.value; // preserve user case for display
  const lower = original.toLowerCase();

  // Check collision
  const hRef = doc(db, "handles", lower);
  const hSnap = await getDoc(hRef);
  if (hSnap.exists() && hSnap.data()?.uid !== uid) {
    throw new Error("Handle already taken");
  }

  // Find old handle (if any)
  const pRef = doc(db, "profiles", uid);
  const pSnap = await getDoc(pRef);
  const oldLower = (pSnap.exists() ? (pSnap.data()?.handleLower || "") : "").toString();

  // Write new mapping + profile
  await setDoc(hRef, { uid, original, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(pRef, { handle: original, handleLower: lower, updatedAt: Date.now() }, { merge: true });

  // Release old mapping if it belonged to this uid and differs
  if (oldLower && oldLower !== lower) {
    try {
      const oldRef = doc(db, "handles", oldLower);
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
        await deleteDoc(oldRef);
      }
    } catch {}
  }

  return { handle: original, handleLower: lower };
}

export async function getCurrentHandle(uid) {
  if (!uid) return null;
  const pRef = doc(db, "profiles", uid);
  const pSnap = await getDoc(pRef);
  if (!pSnap.exists()) return null;
  const d = pSnap.data() || {};
  return d.handle || null;
}

export async function resolveHandle(handle) {
  const clean = sanitizeHandle(handle);
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const ref = doc(db, "handles", lower);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data(); // { uid, original, ... }
}
