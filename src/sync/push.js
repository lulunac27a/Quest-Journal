import {
  db,
  firebaseEnabled,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "../lib/firebase.js";

import {
  syncState,
  io,
  setStatus,
  readLocalResetEpoch,
  writeLocalResetEpoch,
  writeSuppressPushOnce,
  writeSuppressPushWindow,
  writeSuppressPullWindow,
  isPushSuppressed,
  getLocalSnapshot,
} from "./sharedState.js";

const BASE_DEBOUNCE_MS = 1200;
const MAX_DOC_SAFE = 900 * 1024;
const MAX_BATCH_WRITES = 400;
let lastIssuedClientTs = 0;

function resetFloor(uid) {
  if (!uid) return 0;
  try {
    const localEpoch = Number(readLocalResetEpoch(uid) || 0);
    const seenEpoch = Number(syncState.lastResetEpochSeen || 0);
    return Math.max(localEpoch, seenEpoch);
  } catch {
    return Number(readLocalResetEpoch(uid) || 0) || 0;
  }
}

function issueClientTimestamp(uid, prefer = 0) {
  const base = Math.max(Number(prefer) || 0, Date.now());
  const floor = resetFloor(uid) + 1;
  const next = Math.max(base, floor, lastIssuedClientTs + 1);
  lastIssuedClientTs = next;
  return next;
}

async function commitBatchOperations(ops = []) {
  let i = 0;
  while (i < ops.length) {
    const batch = writeBatch(db);
    let taken = 0;
    while (taken < MAX_BATCH_WRITES && i < ops.length) {
      const op = ops[i++];
      if (!op) continue;
      if (op.type === "set") batch.set(op.ref, op.data, op.options || { merge: true });
      else if (op.type === "delete") batch.delete(op.ref);
    }
    console.log("BATCH COMMITTING", taken, "ops"); // temp
    await batch.commit();
  }
}

function docUpdatedTs(obj, fallback = 0) {
  try {
    const a = dateToMs(obj?.updatedAt);
    const b = dateToMs(obj?.meta?.updatedAt);
    const c = Number(obj?.clientUpdatedAt || 0);
    const d = Number(obj?.metaClient?.clientUpdatedAt || 0);
    return Math.max(a || 0, b || 0, c || 0, d || 0, fallback || 0);
  } catch {
    return fallback || 0;
  }
}

function dateToMs(x) {
  if (!x) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") return Date.parse(x) || 0;
  if (typeof x === "object" && typeof x.toMillis === "function") {
    try { return x.toMillis(); } catch { return 0; }
  }
  return 0;
}

function estimateDocBytes(body, clientTs) {
  try {
    const { tasks: __t, journals: __j, ...restForGuard } = body || {};
    const proto = { ...(cleanForFirestore(restForGuard) || {}) };
    const withMeta = {
      ...proto,
      updatedAt: 0,
      meta: { ...(proto.meta || {}), updatedAt: 0 },
      clientUpdatedAt: clientTs,
      metaClient: { ...(proto.metaClient || {}), clientUpdatedAt: clientTs },
    };
    const json = JSON.stringify(withMeta);
    try {
      return new TextEncoder().encode(json).length;
    } catch {
      return json.length;
    }
  } catch {
    return 0;
  }
}

function ensureDocSizeWithinLimit(body, clientTs) {
  const approx = estimateDocBytes(body, clientTs);
  if (approx > MAX_DOC_SAFE) {
    setStatus({ state: "error", error: "Cloud payload too large (" + approx + " bytes). Clear completed or split data." });
    throw new Error("payload-too-large");
  }
}

function buildDocPayload(body, clientTs) {
  const { tasks: _dropTasks, journals: _dropJournals, ...rest } = body || {};
  return {
    ...cleanForFirestore(rest),
    updatedAt: serverTimestamp(),
    meta: { ...(body?.meta || {}), updatedAt: serverTimestamp() },
    clientUpdatedAt: clientTs,
    metaClient: { ...(body?.metaClient || {}), clientUpdatedAt: clientTs },
  };
}

export function createPushController({
  stateDocRef,
  tasksOpenColRef,
  tasksDoneColRef,
  journalsColRef,
  clearPolling,
  restartRealtime,
  pullNow,
  startPolling,
}) {
  function notifyLocalChange() {
    if (!firebaseEnabled || !syncState.user) return;
    if (syncState.isApplyingRemote) return;
    if (!syncState.bootstrapped) return;
    if (isPushSuppressed(syncState.user.uid)) return;
    clearTimeout(syncState.flushTimer);
    syncState.flushTimer = setTimeout(() => flushNow(), BASE_DEBOUNCE_MS + (syncState.backoffMs || 0));
  }

  async function flushNow() {
    try {
      const uid = syncState.user?.uid || "";
      if (!uid) return;
      // Avoid pushing before initial bootstrap finishes to prevent overwriting remote state
      if (!syncState.bootstrapped) return;
      if (isPushSuppressed(uid)) return;
      try {
        const le = Number(readLocalResetEpoch(uid) || 0);
        const ref = stateDocRef(uid);
        const snap = await getDoc(ref);
        if (snap?.exists()) {
          const remote = snap.data() || {};
          const re = Number(remote?.resetEpoch || 0);
          if (re && re > le) return;
        }
      } catch {}
    } catch {}
    if (!firebaseEnabled || !syncState.user) return;
    try {
      setStatus({ state: "syncing" });
      await pushFullState(syncState.user.uid);
      syncState.backoffMs = 0;
      setStatus({ state: "idle", lastSyncAt: Date.now() });
    } catch (e) {
      syncState.backoffMs = Math.min(16000, syncState.backoffMs ? syncState.backoffMs * 2 : 1000);
      console.error("flushNow error:", e);//temp
      setStatus({ state: "error", error: String(e?.message || e) });
    }
  }

  async function pushFullState(uid) {
    const ref = stateDocRef(uid);
    const snapshot = getLocalSnapshot();
    const body = (snapshot !== undefined ? snapshot : null) || (io.packState?.() || {});
    const clientTs = issueClientTimestamp(uid);
    const localTs = docUpdatedTs(body, clientTs);
    let remoteTs = 0;
    let remoteResetEpoch = 0;
    try {
      const existing = await getDoc(ref);
      if (existing?.exists?.()) {
        const data = existing.data() || {};
        remoteTs = docUpdatedTs(data);
        remoteResetEpoch = Number(data.resetEpoch || 0);
      }
    } catch {}
    if (remoteResetEpoch && remoteResetEpoch > Number(readLocalResetEpoch(uid) || 0)) {
      setStatus({ state: "error", error: "Remote reset is newer; pull before pushing" });
      return;
    }
    if (remoteTs && localTs && remoteTs > localTs) {
      setStatus({ state: "error", error: "Remote data is newer; pull before pushing" });
      return;
    }

    try {
      ensureDocSizeWithinLimit(body, clientTs);
    } catch (e) {
      if (String(e?.message || e) === "payload-too-large") throw e;
    }

    const { tasks: localTasksRaw, journals: localJournalsRaw } = (body || {});
    const payload = buildDocPayload(body, clientTs);

    // Replace the doc to ensure removed fields are cleared server-side
    console.log("WRITE STATE:", ref.path, payload);
    await setDoc(ref, payload, { merge: false });
    // Mirror public stats to profiles/{uid} so friends/leaderboards can read without hitting private state docs
    try {
      const profileRef = doc(db, "profiles", uid);
      const xpValue = Number(body?.xp || 0);
      const profilePatch = {
        xp: xpValue,
        clientUpdatedAt: clientTs,
        metaClient: { ...(body?.metaClient || {}), clientUpdatedAt: clientTs },
        updatedAt: serverTimestamp(),
      };
      await setDoc(profileRef, profilePatch, { merge: true });
    } catch (e) {
      console.warn("Failed to mirror xp to profile", e);
    }
    io.writeLocalUpdated(clientTs, uid);
    setStatus({ lastSyncAt: Date.now() });

    const ops = [];
    const localTasks = Array.isArray(localTasksRaw) ? localTasksRaw : [];
    const localTaskIds = new Set();
    for (const t of localTasks) {
      if (!t || !t.id) continue;
      localTaskIds.add(t.id);
      const remoteOpen = syncState.remoteTasksOpen.get(t.id) || null;
      const remoteDone = syncState.remoteTasksDone.get(t.id) || null;
      const remote = remoteOpen || remoteDone || null;
      const ltBase = dateToMs(t.updatedAt || t.doneAt || t.createdAt || 0);
      const ltClient = Number(t.clientUpdatedAt || 0);
      const lt = Math.max(ltBase, ltClient);
      const rtBase = dateToMs(remote?.updatedAt || remote?.doneAt || remote?.createdAt || 0);
      const rtClient = Number(remote?.clientUpdatedAt || 0);
      const rt = Math.max(rtBase, rtClient);

      const targetIsDone = !!t.done;
      const currentlyInDone = !!remoteDone;
      const currentlyInOpen = !!remoteOpen;

      if (remote && targetIsDone !== currentlyInDone) {
        const oldRef = currentlyInDone ? doc(tasksDoneColRef(uid), t.id) : doc(tasksOpenColRef(uid), t.id);
        ops.push({ type: "delete", ref: oldRef });
        const newRef = targetIsDone ? doc(tasksDoneColRef(uid), t.id) : doc(tasksOpenColRef(uid), t.id);
        const cleaned = cleanForFirestore(t);
        const clientT = issueClientTimestamp(uid, Math.max(lt || 0, Date.now()));
        cleaned.clientUpdatedAt = clientT;
        cleaned.updatedAt = serverTimestamp();
        if (typeof cleaned.meta === "object" && cleaned.meta) cleaned.meta.updatedAt = serverTimestamp();
        console.log("WRITE DOC (task/journal):", newRef.path, cleaned); // temp
        ops.push({ type: "set", ref: newRef, data: cleaned, options: { merge: true } });
        if (targetIsDone) {
          syncState.remoteTasksDone.set(t.id, { ...(remote || {}), ...t });
          syncState.remoteTasksOpen.delete(t.id);
        } else {
          syncState.remoteTasksOpen.set(t.id, { ...(remote || {}), ...t });
          syncState.remoteTasksDone.delete(t.id);
        }
        syncState.remoteTasks.set(t.id, { ...(remote || {}), ...t });
        continue;
      }

      if (!remote || lt > rt) {
        const collectionRef = targetIsDone ? tasksDoneColRef(uid) : tasksOpenColRef(uid);
        const dref = doc(collectionRef, t.id);
        const cleaned = cleanForFirestore(t);
        const clientT = issueClientTimestamp(uid, Math.max(lt || 0, Date.now()));
        cleaned.clientUpdatedAt = clientT;
        cleaned.updatedAt = serverTimestamp();
        if (typeof cleaned.meta === "object" && cleaned.meta) cleaned.meta.updatedAt = serverTimestamp();
        console.log("WRITE DOC (task/journal):", dref.path, cleaned); // temp
        ops.push({ type: "set", ref: dref, data: cleaned, options: { merge: true } });
        if (targetIsDone) syncState.remoteTasksDone.set(t.id, { ...(remote || {}), ...t });
        else syncState.remoteTasksOpen.set(t.id, { ...(remote || {}), ...t });
        syncState.remoteTasks.set(t.id, { ...(remote || {}), ...t });
      }
    }

    try {
      if (syncState.collectionsReady) {
        for (const id of Array.from(syncState.remoteTasksOpen.keys())) {
          if (!localTaskIds.has(id)) {
            ops.push({ type: "delete", ref: doc(tasksOpenColRef(uid), id) });
            syncState.remoteTasksOpen.delete(id); syncState.remoteTasks.delete(id);
          }
        }
        for (const id of Array.from(syncState.remoteTasksDone.keys())) {
          if (!localTaskIds.has(id)) {
            ops.push({ type: "delete", ref: doc(tasksDoneColRef(uid), id) });
            syncState.remoteTasksDone.delete(id); syncState.remoteTasks.delete(id);
          }
        }
      }
    } catch {}

    const localJournals = (typeof localJournalsRaw === "object" && localJournalsRaw) ? localJournalsRaw : {};
    const localJournalIds = new Set(Object.keys(localJournals || {}));
    for (const [id, e] of Object.entries(localJournals)) {
      if (!id || !e) continue;
      const remote = syncState.remoteJournals.get(id) || null;
      const ltBase = dateToMs(e?.meta?.updatedAt || e?.updatedAt || 0);
      const ltClient = Number(e?.clientUpdatedAt || 0);
      const lt = Math.max(ltBase, ltClient);
      const rtBase = dateToMs(remote?.meta?.updatedAt || remote?.updatedAt || 0);
      const rtClient = Number(remote?.clientUpdatedAt || 0);
      const rt = Math.max(rtBase, rtClient);
      if (!remote || lt > rt) {
        const dref = doc(journalsColRef(uid), id);
      const cleaned = cleanForFirestore({ ...e, id });
      const clientT = issueClientTimestamp(uid, Math.max(lt || 0, Date.now()));
        cleaned.clientUpdatedAt = clientT;
        if (typeof cleaned.meta !== "object" || !cleaned.meta) cleaned.meta = {};
        cleaned.meta.updatedAt = serverTimestamp();
        console.log("WRITE DOC (task/journal):", dref.path, cleaned); // temp
        ops.push({ type: "set", ref: dref, data: cleaned, options: { merge: true } });
        syncState.remoteJournals.set(id, { ...(remote || {}), ...e, id });
      }
    }

    try {
      if (syncState.collectionsReady) {
        for (const id of Array.from(syncState.remoteJournals.keys())) {
          if (!localJournalIds.has(id)) {
            ops.push({ type: "delete", ref: doc(journalsColRef(uid), id) });
            syncState.remoteJournals.delete(id);
          }
        }
      }
    } catch {}

    if (ops.length) {
      await commitBatchOperations(ops);
    }
  }

  async function overwriteCollectionsWithSnapshot(uid, snapshot = {}) {
    const localTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    const rawJournals = (snapshot.journals && typeof snapshot.journals === "object") ? snapshot.journals : {};
    const clearOps = [];
    const openSnap = await getDocs(tasksOpenColRef(uid));
    openSnap.forEach((docSnap) => { try { clearOps.push({ type: "delete", ref: docSnap.ref }); } catch {} });
    const doneSnap = await getDocs(tasksDoneColRef(uid));
    doneSnap.forEach((docSnap) => { try { clearOps.push({ type: "delete", ref: docSnap.ref }); } catch {} });
    const journalSnap = await getDocs(journalsColRef(uid));
    journalSnap.forEach((docSnap) => { try { clearOps.push({ type: "delete", ref: docSnap.ref }); } catch {} });
    if (clearOps.length) await commitBatchOperations(clearOps);

    const ops = [];
    const openMap = new Map();
    const doneMap = new Map();
    const allMap = new Map();
    for (const t of localTasks) {
      if (!t || !t.id) continue;
      const cleaned = cleanForFirestore(t);
      const base = Number(Date.parse(t.updatedAt || t.doneAt || t.createdAt || 0) || 0);
      const clientT = issueClientTimestamp(uid, Math.max(base, Date.now()));
      cleaned.clientUpdatedAt = clientT;
      cleaned.updatedAt = serverTimestamp();
      if (typeof cleaned.meta === "object" && cleaned.meta) cleaned.meta.updatedAt = serverTimestamp();
      const targetRef = doc(t.done ? tasksDoneColRef(uid) : tasksOpenColRef(uid), t.id);
      ops.push({ type: "set", ref: targetRef, data: cleaned, options: { merge: true } });
      const clone = { ...t };
      allMap.set(t.id, clone);
      if (t.done) doneMap.set(t.id, clone);
      else openMap.set(t.id, clone);
    }

    const journMap = new Map();
    for (const [id, entry] of Object.entries(rawJournals)) {
      if (!id || !entry) continue;
      const cleaned = cleanForFirestore({ ...entry, id });
      const base = Number(Date.parse(entry?.meta?.updatedAt || entry?.updatedAt || 0) || 0);
      const clientT = issueClientTimestamp(uid, Math.max(base, Date.now()));
      cleaned.clientUpdatedAt = clientT;
      if (typeof cleaned.meta !== "object" || !cleaned.meta) cleaned.meta = {};
      cleaned.meta.updatedAt = serverTimestamp();
      ops.push({ type: "set", ref: doc(journalsColRef(uid), id), data: cleaned, options: { merge: true } });
      journMap.set(id, { ...entry, id });
    }
    if (ops.length) await commitBatchOperations(ops);
    syncState.remoteTasks = allMap;
    syncState.remoteTasksOpen = openMap;
    syncState.remoteTasksDone = doneMap;
    syncState.remoteJournals = journMap;
  }

  async function resetRemoteToDefaults(payload = {}) {
    if (!firebaseEnabled || !syncState.user) return;
    const uid = syncState.user.uid;
    const ref = stateDocRef(uid);
    try {
      setStatus({ state: "syncing" });
      const cleaned = cleanForFirestore(payload) || {};
      const stamp = serverTimestamp();
      const clientTs = issueClientTimestamp(uid);
      const epoch = issueClientTimestamp(uid);
      const body = {
        ...cleaned,
        updatedAt: stamp,
        meta: { ...(cleaned.meta || {}), updatedAt: stamp },
        clientUpdatedAt: clientTs,
        metaClient: { ...(cleaned.metaClient || {}), clientUpdatedAt: clientTs },
        resetEpoch: epoch,
      };
      await setDoc(ref, body, { merge: false });
      const ops = [];
      const openSnap = await getDocs(tasksOpenColRef(uid));
      openSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      const doneSnap = await getDocs(tasksDoneColRef(uid));
      doneSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      const jSnap = await getDocs(journalsColRef(uid));
      jSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      if (ops.length) await commitBatchOperations(ops);
      syncState.remoteTasks = new Map();
      syncState.remoteTasksOpen = new Map();
      syncState.remoteTasksDone = new Map();
      syncState.remoteJournals = new Map();

      io.writeLocalUpdated(clientTs, uid);
      writeLocalResetEpoch(epoch, uid);
      setStatus({ state: "idle", lastSyncAt: Date.now() });
    } catch (e) {
      setStatus({ state: "error", error: String(e?.message || e) });
      throw e;
    }
  }

  async function replaceRemoteSnapshot(snapshot = {}) {
    if (!firebaseEnabled || !syncState.user) throw new Error("Cloud sync disabled");
    const uid = syncState.user.uid;
    try {
      setStatus({ state: "syncing" });
      const clientTs = issueClientTimestamp(uid);
      ensureDocSizeWithinLimit(snapshot, clientTs);
      const docPayload = buildDocPayload(snapshot, clientTs);
      const epoch = issueClientTimestamp(uid);
      docPayload.resetEpoch = epoch;
      await setDoc(stateDocRef(uid), docPayload, { merge: false });
      await overwriteCollectionsWithSnapshot(uid, snapshot);
      io.writeLocalUpdated(clientTs, uid);
      writeLocalResetEpoch(epoch, uid);
      setStatus({ state: "idle", lastSyncAt: Date.now() });
    } catch (e) {
      setStatus({ state: "error", error: String(e?.message || e) });
      throw e;
    }
  }

  async function resetRemoteDeleteAll() {
    if (!firebaseEnabled || !syncState.user) return;
    const uid = syncState.user.uid;
    try {
      setStatus({ state: "syncing" });
      try { clearTimeout(syncState.flushTimer); } catch {}
      const epoch = issueClientTimestamp(uid);
      try {
        const payload = {
          v: 1,
          tombstone: true,
          resetEpoch: epoch,
          updatedAt: serverTimestamp(),
          meta: { updatedAt: serverTimestamp() },
          clientUpdatedAt: epoch,
          metaClient: { clientUpdatedAt: epoch },
          lists: [],
          activeListId: "inbox",
        };
        await setDoc(stateDocRef(uid), payload, { merge: true });
        writeLocalResetEpoch(epoch, uid);
        try { syncState.lastResetEpochSeen = Math.max(syncState.lastResetEpochSeen, epoch); } catch {}
      } catch {}

      const ops = [];
      const openSnap = await getDocs(tasksOpenColRef(uid));
      openSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      const doneSnap = await getDocs(tasksDoneColRef(uid));
      doneSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      const jSnap = await getDocs(journalsColRef(uid));
      jSnap.forEach((d) => { try { ops.push({ type: "delete", ref: d.ref }); } catch {} });
      if (ops.length) await commitBatchOperations(ops);

      writeSuppressPushOnce(uid);
      writeSuppressPushWindow(uid, 12000);
      writeSuppressPullWindow(uid, 12000);
      try {
        const epochLocal = issueClientTimestamp(uid);
        writeLocalResetEpoch(epochLocal, uid);
        try { syncState.lastResetEpochSeen = Math.max(syncState.lastResetEpochSeen, epochLocal); } catch {}
      } catch {}

      syncState.remoteTasks = new Map();
      syncState.remoteTasksOpen = new Map();
      syncState.remoteTasksDone = new Map();
      syncState.remoteJournals = new Map();
      setStatus({ state: "idle", lastSyncAt: Date.now() });
    } catch (e) {
      setStatus({ state: "error", error: String(e?.message || e) });
      throw e;
    }
  }

  function attachWindowListeners() {
    if (typeof window === "undefined") return () => {};
    const onPageHide = () => { try { flushNow(); } catch {} };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        try { flushNow(); } catch {}
        clearPolling();
      } else if (document.visibilityState === "visible") {
        try { restartRealtime(); } catch {}
        try { pullNow(); } catch {}
        try { startPolling(syncState.user?.uid || ""); } catch {}
      }
    };
    const onFocus = () => { try { flushNow(); } catch {} };
    const onOnline = () => {
      try { setStatus({ state: "idle", error: "" }); } catch {}
      try { restartRealtime(); } catch {}
      try { pullNow(); } catch {}
      try { flushNow(); } catch {}
    };
    const onOffline = () => { try { setStatus({ state: "offline" }); } catch {} };
    window.addEventListener("pagehide", onPageHide, { capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      try { window.removeEventListener("pagehide", onPageHide, { capture: true }); } catch {}
      try { document.removeEventListener("visibilitychange", onVisibility); } catch {}
      try { window.removeEventListener("focus", onFocus); } catch {}
      try { window.removeEventListener("online", onOnline); } catch {}
      try { window.removeEventListener("offline", onOffline); } catch {}
    };
  }

  return {
    notifyLocalChange,
    flushNow,
    resetRemoteToDefaults,
    resetRemoteDeleteAll,
    attachWindowListeners,
    pushFullState,
    replaceRemoteSnapshot,
  };
}

function cleanForFirestore(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : cleanForFirestore(v)));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = cleanForFirestore(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  if (Number.isNaN(value)) return null;
  return value;
}
