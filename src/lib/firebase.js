// src/lib/firebase.js
// یک مبدأ واحدِ تمیز برای Firebase (با Vite)
// - config از import.meta.env می‌آید
// - فقط init و export primitiveها؛ هیچ منطق بیزنسی اینجا نیست

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
} from "firebase/firestore";
import { getAuthPersistencePreference } from "./authPersistence.js";

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID, // باید web باشد
};

export const firebaseEnabled = Boolean(
  cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId
);

// --- App/Auth/DB
export const app = firebaseEnabled ? (getApps()[0] || initializeApp(cfg)) : null;
export const auth = firebaseEnabled ? getAuth(app) : null;
export const db = firebaseEnabled ? (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
      }),
    });
  } catch {
    // Re-use existing instance or fall back to memory cache if IndexedDB is unavailable.
    return getFirestore(app);
  }
})() : null;

// --- Provider گوگل (با select_account برای سوییچ راحت اکانت)
export const googleProvider = firebaseEnabled ? new GoogleAuthProvider() : null;
if (googleProvider) {
  try { googleProvider.setCustomParameters({ prompt: "select_account" }); } catch {}
}

// --- زنجیره‌ی persistenceِ مقاوم (iOS/Safari Private ok)
export async function ensureAuthPersistence(mode) {
  if (!auth) return;
  const pref = mode || getAuthPersistencePreference();
  const preferSession = pref === "session";
  const targets = preferSession
    ? [browserSessionPersistence, inMemoryPersistence]
    : [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence];
  for (const target of targets) {
    try {
      await setPersistence(auth, target);
      return;
    } catch {}
  }
  // O?OrO?UOU+ O?U,O"O' U?U. O'UcO3O? OrU^O?O_O> U.O'UcU,UO U+UOO3O?OO Auth O_O? O-O"U?O,U??OUO U.U^U,O?UO O"O_O"U.U? U.UO??OO_U?O_.
}
// --- Re-exports موردنیاز موتور سینک
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
  collection, getDocs, writeBatch, updateDoc, deleteDoc, runTransaction, query, orderBy,
};
