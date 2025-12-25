import { useCallback, useEffect, useRef, useState } from "react";
import { namespacedKey } from "../core/userLocal.js";
import {
  IDB_MARKER,
  readPersistedRaw,
  readPersistedRawFromIDB,
  writePersistedRaw,
} from "../core/persistStore.js";
import * as Sync from "../sync/index.js";

export default function usePersist(key, initial) {
  const keyRef = useRef(key);
  keyRef.current = key;
  const prevKeyRef = useRef(key);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const hydrationNeededRef = useRef(false);

  const computeDefault = useCallback(() => {
    const init = initialRef.current;
    return typeof init === "function" ? init() : init;
  }, []);

  const readValueForKey = useCallback((targetKey) => {
    const fallback = computeDefault();
    const stored = readPersistedRaw(targetKey);
    if (stored.source === "inline" && stored.value != null) {
      try {
        return { value: JSON.parse(stored.value), needsHydration: false };
      } catch {
        return { value: fallback, needsHydration: false };
      }
    }
    if (stored.source === "idb") {
      return { value: fallback, needsHydration: true };
    }
    return { value: fallback, needsHydration: false };
  }, [computeDefault]);

  const [state, setState] = useState(() => {
    const { value, needsHydration } = readValueForKey(keyRef.current);
    hydrationNeededRef.current = needsHydration;
    return value;
  });

  const hydrateFromIDB = useCallback(async () => {
    const result = await readPersistedRawFromIDB(keyRef.current);
    if (result?.ok && typeof result.value === "string") {
      try {
        setState(JSON.parse(result.value));
      } catch {
        setState(computeDefault());
      }
    }
    hydrationNeededRef.current = false;
  }, [computeDefault]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(state);
    writePersistedRaw(keyRef.current, json);
    try { Sync.touchLocalUpdated?.(Date.now()); } catch {}
  }, [key, state]);

  useEffect(() => {
    const listener = (e) => {
      if (!e || e.storageArea !== localStorage) return;
      const ns = namespacedKey(keyRef.current);
      if (e.key !== ns) return;
      if (e.newValue == null) {
        setState(computeDefault());
        return;
      }
      if (e.newValue === IDB_MARKER) {
        hydrationNeededRef.current = true;
        hydrateFromIDB();
        return;
      }
      try {
        setState(JSON.parse(e.newValue));
      } catch {
        setState(computeDefault());
      }
    };
    try { window.addEventListener("storage", listener); } catch {}
    return () => { try { window.removeEventListener("storage", listener); } catch {} };
  }, [computeDefault, hydrateFromIDB]);

  useEffect(() => {
    const off = Sync.onUser?.(() => {
      const { value, needsHydration } = readValueForKey(keyRef.current);
      hydrationNeededRef.current = needsHydration;
      setState(value);
      if (needsHydration) hydrateFromIDB();
    });
    return () => { try { off?.(); } catch {} };
  }, [readValueForKey, hydrateFromIDB]);

  useEffect(() => {
    if (!hydrationNeededRef.current) return;
    hydrationNeededRef.current = false;
    hydrateFromIDB();
  }, [hydrateFromIDB]);

  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    keyRef.current = key;
    const { value, needsHydration } = readValueForKey(key);
    hydrationNeededRef.current = needsHydration;
    setState(value);
    if (needsHydration) hydrateFromIDB();
  }, [key, readValueForKey, hydrateFromIDB]);

  return [state, setState];
}
