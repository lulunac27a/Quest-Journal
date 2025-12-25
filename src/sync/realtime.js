import {
  firebaseEnabled,
  getDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
} from "../lib/firebase.js";

import {
  syncState,
  io,
  setStatus,
  readLocalResetEpoch,
  writeLocalResetEpoch,
  isPullSuppressed,
  isPushSuppressed,
  notifyRemote,
  notifyApplyRemote,
  getLocalSnapshot,
} from "./sharedState.js";

const POLL_INTERVAL_MS = 8000;
const now = () => Date.now();

export function createRealtimeController({
  stateDocRef,
  tasksOpenColRef,
  tasksDoneColRef,
  journalsColRef,
  pushFullState,
}) {
  function remoteUpdatedTs(remote) {
    try {
      const srvDoc = dateToTs(remote?.updatedAt);
      const srvMeta = dateToTs(remote?.meta?.updatedAt);
      const cliDoc = Number(remote?.clientUpdatedAt || 0);
      const cliMeta = Number(remote?.metaClient?.clientUpdatedAt || 0);
      const srv = Math.max(srvDoc || 0, srvMeta || 0);
      const cli = Math.max(cliDoc || 0, cliMeta || 0);
      return Math.max(srv, cli);
    } catch {
      return 0;
    }
  }

  function localSnapshotUpdatedTs() {
    const snap = getLocalSnapshot();
    if (!snap || typeof snap !== "object") return 0;
    try {
      const doc = dateToTs(snap?.updatedAt);
      const meta = dateToTs(snap?.meta?.updatedAt);
      const client = Number(snap?.clientUpdatedAt || 0);
      const metaClient = Number(snap?.metaClient?.clientUpdatedAt || 0);
      return Math.max(doc || 0, meta || 0, client || 0, metaClient || 0);
    } catch {
      return 0;
    }
  }

  function clearRemoteMirrors() {
    syncState.remoteTasks = new Map();
    syncState.remoteTasksOpen = new Map();
    syncState.remoteTasksDone = new Map();
    syncState.remoteJournals = new Map();
    syncState.collectionsReady = false;
  }

  function doApplyRemote(remote, uid, phase, { force = false } = {}) {
    syncState.isApplyingRemote = true;
    try {
      io.applyRemoteOrMerge(remote, { force: !!force, uid });
      notifyApplyRemote(remote, uid, phase);
      try { io.writeLocalUpdated(remoteUpdatedTs(remote) || now(), uid); } catch {}
      try {
        const re = Number(remote?.resetEpoch || 0);
        if (re) writeLocalResetEpoch(re, uid);
      } catch {}
      setStatus({ lastSyncAt: Date.now() });
    } finally { syncState.isApplyingRemote = false; }
  }

  function mapTasksFromQuerySnapshot(qs, done) {
    const map = new Map();
    try {
      qs.forEach((d) => {
        const v = d.data() || {};
        const id = d.id;
        map.set(id, { ...v, id, done: !!done });
      });
    } catch {}
    return map;
  }

  async function bootstrap(uid, { forceRemote = false } = {}) {
    if (!firebaseEnabled) return;
    const ref = stateDocRef(uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      if (isPullSuppressed(uid)) return;
      const full = snap.data() || {};
      const { tasks: _dropTasks, journals: _dropJournals, ...remote } = full;
      notifyRemote(remote, uid, "bootstrap");

      const ru = remoteUpdatedTs(remote);
      const re = Number(remote?.resetEpoch || 0);
      const lu = Number(io.readLocalUpdated(uid) || 0);
      const le = Number(readLocalResetEpoch(uid) || 0);
      const localTs = localSnapshotUpdatedTs();
      const localMissing = localTs <= 0;
      const localBehindRemote = !!(ru && localTs && localTs < ru);
      const epochForcesRemote = re && re > le;
      const shouldTakeRemote =
        forceRemote ||
        epochForcesRemote ||
        localMissing ||
        localBehindRemote ||
        !(lu && lu > ru);

      doApplyRemote(remote, uid, "bootstrap", { force: !!shouldTakeRemote });
    } else {
      if (!(isPushSuppressed(uid)) && !syncState.accountJustSwitched) {
        await pushFullState(uid);
      }
    }

    try { await loadSubcollections(uid, { emit: true }); } catch {}
  }

  function startRealtime(uid) {
    if (!firebaseEnabled) return () => {};
    const ref = stateDocRef(uid);

    syncState.unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites || syncState.isApplyingRemote) return;
      if (isPullSuppressed(uid)) return;

      const full = snap.data() || {};
      const { tasks: _dropTasks, journals: _dropJournals, ...remote } = full;
      const ru = remoteUpdatedTs(remote);
      const re = Number(remote?.resetEpoch || 0);
      if (re && re > syncState.lastResetEpochSeen) syncState.lastResetEpochSeen = re;
      const lu = Number(io.readLocalUpdated(uid) || 0);
      const le = Number(readLocalResetEpoch(uid) || 0);
      const epochForcesRemote = re && re > le;

      notifyRemote(remote, uid, "realtime");
      if (re && re > 0) {
        try { syncState.lastResetEpochSeen = Math.max(syncState.lastResetEpochSeen, re); } catch {}
        try { loadSubcollections(uid, { emit: true }); } catch {}
      }
      doApplyRemote(remote, uid, "realtime", { force: epochForcesRemote });
    });

    return syncState.unsubscribe;
  }

  function startRealtimeCollections(uid) {
    if (!firebaseEnabled) return () => {};
    try { syncState.tasksOpenUnsub?.(); } catch {}
    try { syncState.tasksDoneUnsub?.(); } catch {}
    try { syncState.journalsUnsub?.(); } catch {}

    const applyCombinedTasks = () => {
      const combinedMap = new Map();
      const arr = [];
      for (const m of [syncState.remoteTasksOpen, syncState.remoteTasksDone]) {
        m.forEach((obj, id) => { combinedMap.set(id, obj); arr.push(obj); });
      }
      try {
        const localSnapshot = getLocalSnapshot();
        if (localSnapshot !== undefined) {
          const local = (localSnapshot || {}).tasks || [];
          const byId = new Map();
          for (const t of Array.isArray(local) ? local : []) { if (t && t.id) byId.set(t.id, t); }
          const ts = (x) => {
            if (!x) return 0;
            if (typeof x === "number") return x;
            if (typeof x === "string") { const n = Date.parse(x); return Number.isFinite(n) ? n : 0; }
            if (typeof x === "object" && typeof x.toMillis === "function") { try { return x.toMillis(); } catch { return 0; } }
            return 0;
          };
          const filtered = [];
          for (const obj of arr) {
            const l = byId.get(obj?.id);
            if (!l) { filtered.push(obj); continue; }
            const ltBase = ts(l.updatedAt || l.doneAt || l.createdAt);
            const rtBase = ts(obj.updatedAt || obj.doneAt || obj.createdAt);
            const ltClient = Number(l.clientUpdatedAt || 0);
            const rtClient = Number(obj.clientUpdatedAt || 0);
            const lt = Math.max(ltBase, ltClient);
            const rt = Math.max(rtBase, rtClient);
            if (lt > rt) continue;
            try {
              const statusesDiffer = !!l.done !== !!obj.done;
              if (statusesDiffer) {
                const resetActive = (() => {
                  try { return Number(syncState.lastResetEpochSeen || 0) > 0 && (Date.now() - Number(syncState.lastResetEpochSeen)) < 30000; }
                  catch { return false; }
                })();
                if (!resetActive) {
                  const nowMs = Date.now();
                  const LOCAL_GRACE_MS = 6000;
                  if (nowMs - Math.max(lt, ltBase) < LOCAL_GRACE_MS) continue;
                }
              }
            } catch {}
            filtered.push(obj);
          }
          try {
            const resetActive = (() => {
              try { return Number(syncState.lastResetEpochSeen || 0) > 0 && (Date.now() - Number(syncState.lastResetEpochSeen)) < 30000; }
              catch { return false; }
            })();
            if (!resetActive) {
              const LOCAL_INCLUDE_MS = 8000;
              const remoteIds = new Set(filtered.map((x) => x?.id).filter(Boolean));
              for (const l of (Array.isArray(local) ? local : [])) {
                if (!l?.id || remoteIds.has(l.id)) continue;
                const ltBase = ts(l.updatedAt || l.doneAt || l.createdAt);
                const ltClient = Number(l.clientUpdatedAt || 0);
                const lt = Math.max(ltBase, ltClient);
                if (Date.now() - lt < LOCAL_INCLUDE_MS) filtered.push(l);
              }
            }
          } catch {}
          arr.length = 0; filtered.forEach((x) => arr.push(x));
        }
      } catch {}
      syncState.remoteTasks = combinedMap;
      const remoteObj = { tasks: arr, resetEpoch: syncState.lastResetEpochSeen };
      notifyRemote(remoteObj, uid, "subcol-tasks");
      syncState.isApplyingRemote = true;
      try {
        io.applyRemoteOrMerge(remoteObj, { force: false, uid });
        notifyApplyRemote(remoteObj, uid, "subcol-tasks");
        setStatus({ lastSyncAt: Date.now() });
      } finally { syncState.isApplyingRemote = false; }
    };

    const tOpenQuery = query(tasksOpenColRef(uid), orderBy("updatedAt", "desc"));
    syncState.tasksOpenUnsub = onSnapshot(tOpenQuery, (qs) => {
      if (syncState.isApplyingRemote) return;
      if (isPullSuppressed(uid)) return;
      try { if (qs?.metadata?.hasPendingWrites) return; } catch {}
      syncState.remoteTasksOpen = mapTasksFromQuerySnapshot(qs, false);
      syncState.collectionsReady = true;
      applyCombinedTasks();
    });

    const tDoneQuery = query(tasksDoneColRef(uid), orderBy("updatedAt", "desc"));
    syncState.tasksDoneUnsub = onSnapshot(tDoneQuery, (qs) => {
      if (syncState.isApplyingRemote) return;
      if (isPullSuppressed(uid)) return;
      try { if (qs?.metadata?.hasPendingWrites) return; } catch {}
      syncState.remoteTasksDone = mapTasksFromQuerySnapshot(qs, true);
      syncState.collectionsReady = true;
      applyCombinedTasks();
    });

    syncState.journalsUnsub = onSnapshot(journalsColRef(uid), (qs) => {
      if (syncState.isApplyingRemote) return;
      if (isPullSuppressed(uid)) return;
      const map = new Map(); const out = {};
      qs.forEach((d) => { const v = d.data() || {}; const id = d.id; const obj = { ...v, id }; map.set(id, obj); out[id] = obj; });
      syncState.remoteJournals = map;
      syncState.collectionsReady = true;
      const remoteObj = { journals: out, resetEpoch: syncState.lastResetEpochSeen };
      notifyRemote(remoteObj, uid, "subcol-journals");
      doApplyRemote(remoteObj, uid, "subcol-journals", { force: false });
    });

    return () => {
      try { syncState.tasksOpenUnsub?.(); } catch {}
      try { syncState.tasksDoneUnsub?.(); } catch {}
      try { syncState.journalsUnsub?.(); } catch {}
    };
  }

  async function loadSubcollections(uid, { emit = false } = {}) {
    if (!firebaseEnabled || !uid) return;
    if (isPullSuppressed(uid)) return;
    const tOpenSnap = await getDocs(tasksOpenColRef(uid));
    const tDoneSnap = await getDocs(tasksDoneColRef(uid));
    const tasks = []; const tMap = new Map();
    const tOpenMap = mapTasksFromQuerySnapshot(tOpenSnap, false);
    const tDoneMap = mapTasksFromQuerySnapshot(tDoneSnap, true);
    tOpenMap.forEach((obj, id) => { tasks.push(obj); tMap.set(id, obj); });
    tDoneMap.forEach((obj, id) => { tasks.push(obj); tMap.set(id, obj); });
    syncState.remoteTasks = tMap; syncState.remoteTasksOpen = tOpenMap; syncState.remoteTasksDone = tDoneMap;

    const jSnap = await getDocs(journalsColRef(uid));
    const jMap = new Map(); const journals = {};
    jSnap.forEach((d) => { const v = d.data() || {}; const id = d.id; const obj = { ...v, id }; jMap.set(id, obj); journals[id] = obj; });
    syncState.remoteJournals = jMap;
    syncState.collectionsReady = true;

    if (emit) {
      const remoteObj = { tasks, journals, resetEpoch: syncState.lastResetEpochSeen };
      notifyRemote(remoteObj, uid, "subcol-bootstrap");
      doApplyRemote(remoteObj, uid, "subcol-bootstrap", { force: false });
    }
  }

  function startPolling(uid) {
    if (!firebaseEnabled) return;
    syncState.pollTimer = setInterval(async () => {
      try { await pullOnce(uid); } catch {}
    }, POLL_INTERVAL_MS);
  }

  async function pullOnce(uid) {
    if (!firebaseEnabled || !uid) return;
    if (isPullSuppressed(uid)) return;
    const ref = stateDocRef(uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const full = snap.data() || {};
    const { tasks: _dropTasks, journals: _dropJournals, ...remote } = full;
    const ru = remoteUpdatedTs(remote);
    const re = Number(remote?.resetEpoch || 0);
    const lu = Number(io.readLocalUpdated(uid) || 0);
    const le = Number(readLocalResetEpoch(uid) || 0);
    const localTs = localSnapshotUpdatedTs();
    const localMissing = localTs <= 0;
    const localBehindRemote = !!(ru && localTs && localTs < ru);
    const epochForcesRemote = re && re > le;
    if (re && re > syncState.lastResetEpochSeen) syncState.lastResetEpochSeen = re;
    if (!(epochForcesRemote || (ru && ru > lu) || localMissing || localBehindRemote)) return;

    notifyRemote(remote, uid, "poll");
    syncState.isApplyingRemote = true;
    try {
      io.applyRemoteOrMerge(remote, { force: false, uid });
      notifyApplyRemote(remote, uid, "poll");
      io.writeLocalUpdated(ru || now(), uid);
      if (re) writeLocalResetEpoch(re, uid);
      setStatus({ lastSyncAt: Date.now() });
    } finally { syncState.isApplyingRemote = false; }

    try { await loadSubcollections(uid, { emit: true }); } catch {}
  }

  async function pullNow() {
    if (!syncState.user || !firebaseEnabled) return;
    await pullOnce(syncState.user.uid);
  }

  return {
    bootstrap,
    startRealtime,
    startRealtimeCollections,
    startPolling,
    pullNow,
    clearRemoteMirrors,
  };
}

function dateToTs(x) {
  if (!x) return 0;
  if (typeof x === "object" && typeof x.toMillis === "function") {
    try { return x.toMillis(); } catch {}
  }
  if (typeof x === "number") return x;
  if (typeof x === "string") return Date.parse(x) || 0;
  return 0;
}
