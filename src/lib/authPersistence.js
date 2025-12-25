const KEY = "qj_auth_persistence_mode";

function readRawPreference() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getAuthPersistencePreference() {
  const raw = readRawPreference();
  if (raw === "session") return "session";
  return "stay";
}

export function setAuthPersistencePreference(mode) {
  const value = mode === "session" ? "session" : "stay";
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, value);
  } catch {}
}

export function shouldStaySignedIn() {
  return getAuthPersistencePreference() !== "session";
}
