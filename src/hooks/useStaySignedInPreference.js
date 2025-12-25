import { useCallback, useEffect, useState } from "react";
import {
  getAuthPersistencePreference,
  setAuthPersistencePreference,
} from "../lib/authPersistence.js";
import { ensureAuthPersistence } from "../lib/firebase.js";

function readInitialPreference() {
  try {
    return getAuthPersistencePreference() !== "session";
  } catch {
    return true;
  }
}

export default function useStaySignedInPreference() {
  const [staySignedIn, setStaySignedIn] = useState(() => readInitialPreference());

  const update = useCallback((next) => {
    const enable = !!next;
    setStaySignedIn(enable);
    const mode = enable ? "stay" : "session";
    try { setAuthPersistencePreference(mode); } catch {}
    try { ensureAuthPersistence(mode); } catch {}
  }, []);

  useEffect(() => {
    setStaySignedIn(readInitialPreference());
  }, []);

  return [staySignedIn, update];
}
