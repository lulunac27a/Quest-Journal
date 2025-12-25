// src/hooks/useProfileGate.js
import { useEffect, useCallback, useState } from "react";
import { loadProfile, saveProfile, migrateProfileFromLegacy } from "../core/profile.js";

export default function useProfileGate({ enqueueToast, setProfileVersion }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    migrateProfileFromLegacy();
    const p = loadProfile() || {};
    if (!p.name) setProfileOpen(true);
    else setProfileName(p.name);
  }, []);

  const saveProfileName = useCallback((value) => {
    const source = typeof value === "string" ? value : profileName;
    const name = (source || "").trim(); if (!name) return false;
    const prev = loadProfile() || {};
    saveProfile({ ...prev, name, createdAt: prev.createdAt || new Date().toISOString(), updatedAt: Date.now() });
    enqueueToast && enqueueToast(`Welcome, ${name}!`, 1500);
    setProfileVersion && setProfileVersion(v => v + 1);
    setProfileOpen(false);
    setProfileName(name);
    return true;
  }, [enqueueToast, profileName, setProfileOpen, setProfileVersion]);

  return { profileOpen, setProfileOpen, profileName, setProfileName, saveProfileName };
}
