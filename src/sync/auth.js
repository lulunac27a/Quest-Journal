import {
  auth,
  db,
  firebaseEnabled,
  googleProvider,
  ensureAuthPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  runTransaction,
  doc,
  setDoc,
  serverTimestamp,
  updateProfile,
} from "../lib/firebase.js";

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  syncState,
  io,
  setStatus,
  setUser,
  setLastUid,
  clearLastUid,
  getLastUid,
} from "./sharedState.js";

const REDIRECT_MARKER_KEY = "qj_auth_redirect_v1";
let signInInFlight = null;

function writeRedirectMarker() {
  try {
    const payload = {
      ts: Date.now(),
      path: location.pathname + location.search + location.hash,
      reloaded: false,
    };
    localStorage.setItem(REDIRECT_MARKER_KEY, JSON.stringify(payload));
  } catch {}
}

function readRedirectMarker() {
  try { return JSON.parse(localStorage.getItem(REDIRECT_MARKER_KEY) || "null"); }
  catch { return null; }
}

function clearRedirectMarker() {
  try { localStorage.removeItem(REDIRECT_MARKER_KEY); } catch {}
}

export function createAuthController({
  clearRealtime,
  clearPolling,
  clearRemoteMirrors,
  bootstrap,
  startRealtime,
  startRealtimeCollections,
  startPolling,
}) {
  function normalizeUsername(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (!v) throw new Error("Username required");
    if (v.length < 3 || v.length > 32) throw new Error("Username must be 3-32 chars");
    if (!/^[a-z0-9_]+$/.test(v)) throw new Error("Use letters, numbers, underscore");
    return v;
  }

  async function reserveUsername(username, uid) {
    if (!username || !uid) throw new Error("username-missing");
    const uname = normalizeUsername(username);
    const ref = doc(db, "usernames", uname);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const existing = (snap.data() || {}).uid;
        if (existing && existing !== uid) throw new Error("username-taken");
      }
      tx.set(ref, {
        uid,
        username: uname,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    });
    return uname;
  }

  function deriveUsernameFromEmail(email) {
    try {
      const local = String(email || "").split("@")[0] || "";
      const base = normalizeUsername(local);
      return base.slice(0, 32);
    } catch {
      return "";
    }
  }

  async function reserveUsernameAuto(email, uid) {
    const base = deriveUsernameFromEmail(email) || `user_${uid?.slice(0, 6) || "x"}`;
    const tryNames = [base];
    for (let i = 1; i <= 5; i++) tryNames.push(`${base}${i}`);
    for (const name of tryNames) {
      try {
        await reserveUsername(name, uid);
        return name;
      } catch (e) {
        if (!String(e?.message || "").includes("username-taken")) throw e;
      }
    }
    // Fallback to uid suffix
    const fallback = `${base}_${Date.now()}`;
    await reserveUsername(fallback, uid);
    return fallback;
  }

  async function signUpWithEmail(emailRaw, passwordRaw) {
    if (!firebaseEnabled) { setStatus({ state: "disabled", error: "Cloud sync disabled" }); return; }
    const email = String(emailRaw || "").trim();
    const password = String(passwordRaw || "");
    if (!email) { setStatus({ state: "error", error: "Email required" }); return; }
    if (!password) { setStatus({ state: "error", error: "Password required" }); return; }
    setStatus({ state: "signing-in", error: "" });
    try { await ensureAuthPersistence(); } catch {}
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uname = await reserveUsernameAuto(email, cred.user.uid);
      try { await updateProfile(cred.user, { displayName: uname }); } catch {}
      try {
        const clientUpdatedAt = Date.now();
        await setDoc(doc(db, "users", cred.user.uid), {
          ownerId: cred.user.uid,
          username: uname,
          displayName: cred.user.displayName || uname,
          updatedAt: serverTimestamp(),
          clientUpdatedAt,
          metaClient: { clientUpdatedAt },
        }, { merge: true });
      } catch {}
      setStatus({ state: "idle", error: "" });
    } catch (err) {
      const code = String(err?.code || err?.message || "");
      let msg = err?.message || "Sign up failed";
      if (code.includes("username")) msg = "Username already taken";
      else if (code.includes("auth/email-already-in-use")) msg = "Email already in use";
      else if (code.includes("auth/weak-password")) msg = "Password too weak";
      setStatus({ state: "error", error: msg });
      throw new Error(msg);
    }
  }

  async function signInWithEmailCredentials(emailRaw, passwordRaw) {
    if (!firebaseEnabled) { setStatus({ state: "disabled", error: "Cloud sync disabled" }); return; }
    const email = String(emailRaw || "").trim();
    const password = String(passwordRaw || "");
    if (!email || !password) { setStatus({ state: "error", error: "Email and password required" }); return; }
    setStatus({ state: "signing-in", error: "" });
    try { await ensureAuthPersistence(); } catch {}
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus({ state: "idle", error: "" });
    } catch (err) {
      const code = String(err?.code || "");
      let msg = err?.message || "Sign in failed";
      if (code.includes("auth/user-not-found")) msg = "Account not found";
      else if (code.includes("auth/wrong-password")) msg = "Wrong password";
      setStatus({ state: "error", error: msg });
      throw new Error(msg);
    }
  }

  async function signInRedirect() {
    if (!firebaseEnabled) return;
    if (signInInFlight) return signInInFlight;
    const job = (async () => {
      setStatus({ state: "signing-in", error: "" });
      try { await ensureAuthPersistence(); } catch {}
      try { writeRedirectMarker(); } catch {}
      await signInWithRedirect(auth, googleProvider);
    })();
    signInInFlight = job.finally(() => { signInInFlight = null; });
    return signInInFlight;
  }

  async function init() {
    if (!firebaseEnabled) { setStatus({ state: "disabled" }); return; }
    await ensureAuthPersistence();

    const marker = readRedirectMarker();
    try { await getRedirectResult(auth); } catch {}

    const safetyReload = () => {
      const mk = readRedirectMarker();
      if (!mk) return;
      if (syncState.user) { clearRedirectMarker(); return; }
      if (mk.reloaded) { clearRedirectMarker(); return; }
      try {
        localStorage.setItem(REDIRECT_MARKER_KEY, JSON.stringify({ ...mk, reloaded: true }));
      } catch {}
      location.replace(mk.path || location.pathname);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", (e) => {
        if (e.persisted) setTimeout(safetyReload, 50);
      });
      if (marker) setTimeout(safetyReload, 1000);
    }

    onAuthStateChanged(auth, async (u) => {
      setUser(u);
      clearRealtime();
      clearPolling();
      syncState.bootstrapped = false;
      clearRemoteMirrors();

      if (u) clearRedirectMarker();

      if (!u) { setStatus({ state: "idle", error: "" }); return; }

      setStatus({ state: "syncing", error: "" });

      const lastUid = getLastUid();
      const localUpdated = Number(io.readLocalUpdated(u.uid) || 0);
      const switched = !!(lastUid && lastUid !== u.uid);
      syncState.accountJustSwitched = switched;
      const mustTakeRemote = switched || !lastUid || localUpdated < 1;

      if (switched) {
        try { io.resetLocalToDefaults?.({ forAccountSwitch: true, uidForSwitch: u.uid }); } catch {}
      }

      try {
        await bootstrap(u.uid, { forceRemote: mustTakeRemote });
        startRealtime(u.uid);
        try { startRealtimeCollections(u.uid); } catch {}
        startPolling(u.uid);
        setLastUid(u.uid);
        syncState.bootstrapped = true;
        setStatus({ state: "idle" });
      } catch (e) {
        setStatus({ state: "error", error: String(e?.message || e) });
      } finally { syncState.accountJustSwitched = false; }
    });
  }

  async function signIn() {
    if (!firebaseEnabled) { setStatus({ state: "disabled", error: "Cloud sync disabled" }); return; }
    if (signInInFlight) return signInInFlight;
    const job = (async () => {
      setStatus({ state: "signing-in", error: "" });
      try { await ensureAuthPersistence(); } catch {}
      try {
        await signInWithPopup(auth, googleProvider);
        clearRedirectMarker();
        setStatus({ state: "idle", error: "" });
        return;
      }
      catch (err) {
        const code = String(err?.code || "");
        const blockedOrUnsupported =
          code.includes("auth/popup-blocked") ||
          code.includes("auth/operation-not-supported-in-this-environment");
        if (blockedOrUnsupported) {
          writeRedirectMarker();
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        const userDismissed =
          code.includes("auth/popup-closed-by-user") ||
          code.includes("auth/cancelled-popup-request");
        const msg = userDismissed ? "" : String(err?.message || "Sign in failed");
        setStatus({ state: userDismissed ? "idle" : "error", error: msg });
        throw err;
      }
    })();
    signInInFlight = job.finally(() => { signInInFlight = null; });
    return signInInFlight;
  }

  async function signOutNow() {
    if (!firebaseEnabled) return;
    clearRedirectMarker();
    await signOut(auth);
    setStatus({ state: "idle" });
  }

  return {
    init,
    signInRedirect,
    signIn,
    signOutNow,
    signUpWithEmail,
    signInWithEmailCredentials,
  };
}
