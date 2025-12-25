import { firebaseEnabled } from "../lib/firebase.js";

export const syncState = {
  user: null,
  status: { state: firebaseEnabled ? "idle" : "disabled", error: "", lastSyncAt: null },
  isApplyingRemote: false,
  unsubscribe: null,
  tasksOpenUnsub: null,
  tasksDoneUnsub: null,
  journalsUnsub: null,
  flushTimer: null,
  backoffMs: 0,
  lastUid: "",
  bootstrapped: false,
  pollTimer: null,
  remoteTasks: new Map(),
  remoteTasksOpen: new Map(),
  remoteTasksDone: new Map(),
  remoteJournals: new Map(),
  accountJustSwitched: false,
  lastResetEpochSeen: 0,
  localGetter: null,
  collectionsReady: false,
};
window.syncState = syncState; //temp

const LS_LAST_UID = "qj_last_uid";
const LEGACY_LOCAL_UPDATED = "qj_last_local_updated";
const LS_RESET_EPOCH = "qj_reset_epoch"; // per-user: `${LS_RESET_EPOCH}:<uid>`
const LS_SUPPRESS_PUSH_UNTIL = "qj_suppress_push_until"; // per-user: `${LS_SUPPRESS_PUSH_UNTIL}:<uid>` stores epoch ms
const LS_SUPPRESS_PUSH_ONCE = "qj_suppress_push_once"; // per-user: `${LS_SUPPRESS_PUSH_ONCE}:<uid>`
const LS_SUPPRESS_PULL_UNTIL = "qj_suppress_pull_until"; // per-user

export const io = {
  packState: () => ({}),
  applyRemoteOrMerge: () => {},
  readLocalUpdated: (uid) => {
    try {
      const perUser = Number(localStorage.getItem(`${LEGACY_LOCAL_UPDATED}:${uid}`));
      if (Number.isFinite(perUser) && perUser > 0) return perUser;
      return Number(localStorage.getItem(LEGACY_LOCAL_UPDATED) || 0);
    } catch { return 0; }
  },
  writeLocalUpdated: (ts, uid) => {
    try {
      localStorage.setItem(`${LEGACY_LOCAL_UPDATED}:${uid}`, String(ts));
      localStorage.setItem(LEGACY_LOCAL_UPDATED, String(ts));
    } catch {}
  },
  resetLocalToDefaults: () => {},
};

export function configureLocalIO(overrides = {}) { Object.assign(io, overrides); }

const statusSubs = new Set();
const userSubs = new Set();
function emitStatus() { statusSubs.forEach((cb) => cb(getStatus())); }
function emitUser() { userSubs.forEach((cb) => cb(getUser())); }
export function onStatus(cb) { statusSubs.add(cb); return () => statusSubs.delete(cb); }
export function onUser(cb) { userSubs.add(cb); return () => userSubs.delete(cb); }
export function getStatus() { return { ...syncState.status }; }
export function getUser() { return syncState.user; }
export function setStatus(partial) {
  console.log("setStatus called:", partial); //temp
  syncState.status = { ...syncState.status, ...partial };
  emitStatus();
}
export function setUser(user) {
  syncState.user = user;
  emitUser();
}

export function setLastUid(uid) {
  try { localStorage.setItem(LS_LAST_UID, uid); } catch {}
  syncState.lastUid = uid;
}
export function clearLastUid() {
  try { localStorage.removeItem(LS_LAST_UID); } catch {}
  syncState.lastUid = "";
}
export function getLastUid() {
  if (syncState.lastUid) return syncState.lastUid;
  try { return localStorage.getItem(LS_LAST_UID) || ""; }
  catch { return ""; }
}
export function touchLocalUpdated(ts = Date.now(), uid) {
  const targetUid = uid || getUser()?.uid || getLastUid();
  if (!targetUid) return;
  try { io.writeLocalUpdated(ts, targetUid); } catch {}
}

export function readLocalResetEpoch(uid) {
  if (!uid) return 0;
  try { return Number(localStorage.getItem(`${LS_RESET_EPOCH}:${uid}`) || 0) || 0; }
  catch { return 0; }
}
export function writeLocalResetEpoch(ts, uid) {
  if (!uid) return;
  try { localStorage.setItem(`${LS_RESET_EPOCH}:${uid}`, String(ts || 0)); } catch {}
}

export function writeSuppressPushOnce(uid) {
  if (!uid) return;
  try { localStorage.setItem(`${LS_SUPPRESS_PUSH_ONCE}:${uid}`, "1"); } catch {}
}
export function consumeSuppressPushOnce(uid) {
  if (!uid) return false;
  try {
    const k = `${LS_SUPPRESS_PUSH_ONCE}:${uid}`;
    const v = localStorage.getItem(k);
    if (v) { localStorage.removeItem(k); return true; }
    return false;
  } catch { return false; }
}

export function writeSuppressPullWindow(uid, ms) {
  if (!uid) return;
  const until = Date.now() + Math.max(0, Number(ms) || 0);
  try { localStorage.setItem(`${LS_SUPPRESS_PULL_UNTIL}:${uid}`, String(until)); } catch {}
}
export function isPullSuppressed(uid) {
  if (!uid) return false;
  try {
    const raw = localStorage.getItem(`${LS_SUPPRESS_PULL_UNTIL}:${uid}`) || "0";
    const until = Number(raw) || 0;
    if (until > Date.now()) return true;
    if (until && Date.now() >= until) {
      try { localStorage.removeItem(`${LS_SUPPRESS_PULL_UNTIL}:${uid}`); } catch {}
    }
    return false;
  } catch { return false; }
}

export function writeSuppressPushWindow(uid, ms) {
  if (!uid) return;
  const until = Date.now() + Math.max(0, Number(ms) || 0);
  try { localStorage.setItem(`${LS_SUPPRESS_PUSH_UNTIL}:${uid}`, String(until)); } catch {}
}
export function isPushSuppressed(uid) {
  if (!uid) return false;
  try {
    if (consumeSuppressPushOnce(uid)) return true;
    const untilRaw = localStorage.getItem(`${LS_SUPPRESS_PUSH_UNTIL}:${uid}`) || "0";
    const until = Number(untilRaw) || 0;
    if (until > Date.now()) return true;
    if (until && Date.now() >= until) {
      try { localStorage.removeItem(`${LS_SUPPRESS_PUSH_UNTIL}:${uid}`); } catch {}
    }
    return false;
  } catch { return false; }
}

const remoteSubs = new Set();
const applyRemoteSubs = new Set();
export function onRemote(cb) { remoteSubs.add(cb); return () => remoteSubs.delete(cb); }
export function onApplyRemote(cb) { applyRemoteSubs.add(cb); return () => applyRemoteSubs.delete(cb); }
export function notifyRemote(remote, uid, phase) {
  try { remoteSubs.forEach((cb) => cb(remote, { uid, phase })); } catch {}
}
export function notifyApplyRemote(remote, uid, phase) {
  try { applyRemoteSubs.forEach((cb) => cb(remote, { uid, phase })); } catch {}
}

export function setLocalSnapshotGetter(fn) {
  syncState.localGetter = typeof fn === "function" ? fn : null;
}
export function getLocalSnapshot() {
  if (typeof syncState.localGetter !== "function") return undefined;
  return syncState.localGetter();
}
