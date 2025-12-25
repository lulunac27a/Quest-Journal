// src/sync/index.js
// Entry point for sync logic: wires auth, realtime, and push controllers.

import {
  db,
  firebaseEnabled,
  doc,
  collection,
} from "../lib/firebase.js";

import { createAuthController } from "./auth.js";
import { createRealtimeController } from "./realtime.js";
import { createPushController } from "./push.js";

const stateDocRef = (uid) => doc(db, "users", uid, "app", "state");
const tasksOpenColRef = (uid) => collection(db, "users", uid, "tasks_open");
const tasksDoneColRef = (uid) => collection(db, "users", uid, "tasks_done");
const journalsColRef = (uid) => collection(db, "users", uid, "journals");

let pushFullStateDelegate = async () => {};

const realtimeController = createRealtimeController({
  stateDocRef,
  tasksOpenColRef,
  tasksDoneColRef,
  journalsColRef,
  pushFullState: (...args) => pushFullStateDelegate(...args),
});

const {
  bootstrap: bootstrapRealtime,
  startRealtime: startRealtimeRealtime,
  startRealtimeCollections: startRealtimeCollectionsRealtime,
  startPolling: startPollingRealtime,
  pullNow: pullNowRealtime,
  clearRemoteMirrors,
} = realtimeController;

export function bootstrap(uid, options = {}) {
  return bootstrapRealtime(uid, options);
}

export function startRealtime(uid) {
  return startRealtimeRealtime(uid);
}

function startRealtimeCollections(uid) {
  return startRealtimeCollectionsRealtime(uid);
}

function startPolling(uid) {
  return startPollingRealtime(uid);
}

export function pullNow() {
  return pullNowRealtime();
}

export {
  configureLocalIO,
  onStatus,
  onUser,
  getStatus,
  getUser,
  getLastUid,
  touchLocalUpdated,
  onRemote,
  onApplyRemote,
  setLocalSnapshotGetter,
} from "./sharedState.js";

import { syncState } from "./sharedState.js";

// --- Local helpers for controller coordination ---

// --- Tunables (centralized to avoid magic numbers) ---
function clearRealtime() {
  try { syncState.unsubscribe?.(); } catch {}
  syncState.unsubscribe = null;
  try { syncState.tasksOpenUnsub?.(); } catch {}
  syncState.tasksOpenUnsub = null;
  try { syncState.tasksDoneUnsub?.(); } catch {}
  syncState.tasksDoneUnsub = null;
  try { syncState.journalsUnsub?.(); } catch {}
  syncState.journalsUnsub = null;
}
function clearPolling() {
  try { clearInterval(syncState.pollTimer); } catch {}
  syncState.pollTimer = null;
}
function restartRealtime() {
  if (!firebaseEnabled || !syncState.user) return;
  try { clearRealtime(); } catch {}
  try { startRealtime(syncState.user.uid); } catch {}
  try { startRealtimeCollections(syncState.user.uid); } catch {}
}

const pushController = createPushController({
  stateDocRef,
  tasksOpenColRef,
  tasksDoneColRef,
  journalsColRef,
  clearPolling,
  restartRealtime,
  pullNow,
  startPolling,
});
pushFullStateDelegate = (...args) => pushController.pushFullState(...args);

export const notifyLocalChange = (...args) => pushController.notifyLocalChange(...args);
export const flushNow = (...args) => pushController.flushNow(...args);
export const resetRemoteToDefaults = (...args) => pushController.resetRemoteToDefaults(...args);
export const resetRemoteDeleteAll = (...args) => pushController.resetRemoteDeleteAll(...args);
export const replaceRemoteSnapshot = (...args) => pushController.replaceRemoteSnapshot(...args);
export const attachWindowListeners = () => pushController.attachWindowListeners();

const authController = createAuthController({
  clearRealtime,
  clearPolling,
  clearRemoteMirrors,
  bootstrap,
  startRealtime,
  startRealtimeCollections,
  startPolling,
});

export const init = () => authController.init();
export const signInRedirect = () => authController.signInRedirect();
export const signIn = () => authController.signIn();
export const signOutNow = () => authController.signOutNow();
export const signUpWithEmail = (...args) => authController.signUpWithEmail?.(...args);
export const signInWithEmail = (...args) => authController.signInWithEmailCredentials?.(...args);
