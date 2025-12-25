// src/social/model.js
import { db, auth } from "../lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";

export function pairIdFor(a, b) {
  const A = String(a || "");
  const B = String(b || "");
  return [A, B].sort().join("_");
}

export async function requestFriend(myUid, otherUid) {
  const a = String(myUid || "").trim();
  const b = String(otherUid || "").trim();
  if (!a || !b || a === b) throw new Error("invalid_uids");
  const pid = pairIdFor(a, b);
  const ref = doc(db, "friendships", pid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { a, b, status: "pending", invitedBy: a, createdAt: serverTimestamp() });
    return { status: "pending" };
  }
  const d = snap.data() || {};
  if (d.status === "blocked") throw new Error("blocked");
  return { status: d.status };
}

export async function acceptFriend(myUid, otherUid) {
  const a = String(myUid || "").trim();
  const b = String(otherUid || "").trim();
  if (!a || !b || a === b) throw new Error("invalid_uids");
  const pid = pairIdFor(a, b);
  const ref = doc(db, "friendships", pid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("not_found");
  const d = snap.data() || {};
  if (d.status === "accepted") return { status: "accepted" };
  await setDoc(ref, { ...d, status: "accepted", acceptedAt: serverTimestamp() });
  return { status: "accepted" };
}

export async function removeFriend(myUid, otherUid) {
  const a = String(myUid || "").trim();
  const b = String(otherUid || "").trim();
  if (!a || !b || a === b) throw new Error("invalid_uids");
  const pid = pairIdFor(a, b);
  const ref = doc(db, "friendships", pid);
  await deleteDoc(ref);
}

export function subscribeFriends(myUid, cb) {
  if (!db || !myUid) return () => {};
  const qA = query(collection(db, "friendships"), where("a", "==", myUid));
  const qB = query(collection(db, "friendships"), where("b", "==", myUid));
  let docs = new Map();
  function emit() {
    const arr = Array.from(docs.values());
    const accepted = arr.filter(d => d.status === 'accepted');
    const pendingIncoming = arr.filter(d => d.status === 'pending' && d.invitedBy && d.invitedBy !== myUid);
    const pendingOutgoing = arr.filter(d => d.status === 'pending' && d.invitedBy && d.invitedBy === myUid);
    cb({ accepted, pendingIncoming, pendingOutgoing });
  }
  const unsubA = onSnapshot(qA, (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') docs.delete(ch.doc.id);
      else docs.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
    });
    emit();
  });
  const unsubB = onSnapshot(qB, (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') docs.delete(ch.doc.id);
      else docs.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
    });
    emit();
  });
  return () => { try { unsubA(); } catch {} try { unsubB(); } catch {} };
}

export function currentUid() {
  try { return auth?.currentUser?.uid || null; } catch { return null; }
}
