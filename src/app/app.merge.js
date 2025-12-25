// src/app/app.merge.js
export const ts = (x) => {
  if (!x) return 0;
  if (typeof x === "string") return Date.parse(x) || 0;
  if (typeof x === "number") return x;
  if (typeof x === "object") {
    try {
      if (typeof x.toMillis === "function") return x.toMillis();
      const s = Number(x.seconds);
      const ns = Number(x.nanoseconds ?? x.nanosecond ?? 0);
      if (Number.isFinite(s)) return (s * 1000) + Math.floor((Number.isFinite(ns) ? ns : 0) / 1e6);
    } catch {}
  }
  return 0;
};
export function mergeTasksByUpdatedAt(localArr, remoteArr) {
  const local = Array.isArray(localArr) ? localArr : [];
  const remote = Array.isArray(remoteArr) ? remoteArr : [];
  const map = new Map();
  for (const t of local) map.set(t.id, t);
  for (const r of remote) {
    if (!r?.id) continue;
    const l = map.get(r.id);
    if (!l) { map.set(r.id, r); continue; }
    const lBase = ts(l.updatedAt || l.deletedAt || l.doneAt || l.createdAt);
    const rBase = ts(r.updatedAt || r.deletedAt || r.doneAt || r.createdAt);
    const lClient = Number(l.clientUpdatedAt || 0);
    const rClient = Number(r.clientUpdatedAt || 0);
    const lt = Math.max(lBase, lClient);
    const rt = Math.max(rBase, rClient);
    if (rt > lt) { map.set(r.id, r); continue; }
    if (lt > rt) { map.set(r.id, l); continue; }
    const lDel = !!l.deleted, rDel = !!r.deleted;
    if (rDel && !lDel) { map.set(r.id, r); continue; }
    try {
      const statusesDiffer = !!l.done !== !!r.done;
      if (statusesDiffer) {
        const nowMs = Date.now();
        const LOCAL_GRACE_MS = 6000;
        if (nowMs - lBase < LOCAL_GRACE_MS) { map.set(r.id, l); continue; }
      }
    } catch {}
    map.set(r.id, l);
  }
  return Array.from(map.values());
}
export function mergeCalendarEventsByUpdatedAt(localArr, remoteArr) {
  const local = Array.isArray(localArr) ? localArr : [];
  const remote = Array.isArray(remoteArr) ? remoteArr : [];
  const map = new Map();
  for (const t of local) if (t?.id) map.set(t.id, t);
  for (const r of remote) {
    if (!r?.id) continue;
    const l = map.get(r.id);
    if (!l) { map.set(r.id, r); continue; }
    const lt = ts(l.updatedAt || l.end || l.start);
    const rt = ts(r.updatedAt || r.end || r.start);
    map.set(r.id, rt >= lt ? r : l);
  }
  return Array.from(map.values());
}