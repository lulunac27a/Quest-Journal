// src/hooks/useBackup.js
import { useCallback } from "react";
import { loadProfile } from "../core/profile.js";
import { loadMultiXP } from "../core/multixp.js";
import { loadAllEntries as loadAllJournalEntries, saveEntry as saveJournalEntry } from "../utils/journalStore.js";
import * as Sync from "../sync/index.js";

function selectJournalFields(e) {
  if (!e || typeof e !== 'object') return null;
  return {
    id: e.id,
    dateISO: e.dateISO,
    title: e.title,
    titleSource: e.titleSource,
    text: e.text,
    meta: e.meta || {},
  };
}

export default function useBackup({ lists, activeListId, tasks, xp, dailyTpl, weeklyTpl, day, week, ach, origin, settings, calendarEvents }, { enqueueToast }, applyRemoteMaybe) {
  const notify = useCallback((text, ms = 1600) => {
    if (enqueueToast) enqueueToast(text, ms);
    else console.warn(text);
  }, [enqueueToast]);

  const packState = useCallback(() => {
    const profile = loadProfile() || {};
    const multiXp = (() => { try { return loadMultiXP(); } catch { return null; } })();
    const nowTs = Date.now();
    const journals = (() => {
      try {
        const map = loadAllJournalEntries();
        const out = {};
        for (const [id, e] of Object.entries(map || {})) {
          const minimal = selectJournalFields(e);
          if (minimal && id) out[id] = minimal;
        }
        return out;
      } catch { return {}; }
    })();

    return {
      v: 1,
      updatedAt: nowTs,
      meta: { updatedAt: nowTs },
      lists, activeListId, tasks, xp,
      dailyTpl, weeklyTpl, day, week, ach, origin, settings, profile,
      ...(multiXp ? { multiXp } : {}),
      calendarEvents,
      journals,
    };
  }, [lists, activeListId, tasks, xp, dailyTpl, weeklyTpl, day, week, ach, origin, settings, calendarEvents]);

  const backupLocalSnapshot = useCallback(() => {
    try {
      const snap = packState();
      const json = JSON.stringify(snap);
      const blob = new Blob([json], { type: "application/json" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `quest-journal-backup-${stamp}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      notify("Backup downloaded", 1400);
    } catch (e) {
      console.warn("Backup failed", e);
      const msg = "Backup failed: " + (e?.message || "unknown error");
      notify(msg, 2000);
    }
  }, [packState, notify]);

  const restoreCloudFromLocalBackup = useCallback(async (file) => {
    try {
      if (!file) {
        notify("No file selected", 1800);
        return;
      }
      const text = await file.text();
      const snap = JSON.parse(text);
      if (!snap || typeof snap !== "object") {
        notify("Invalid backup file", 2000);
        return;
      }
      try { snap.resetEpoch = Date.now(); } catch {}
      {
        const fn =
          typeof applyRemoteMaybe === "function"
            ? applyRemoteMaybe
            : applyRemoteMaybe && applyRemoteMaybe.current
              ? applyRemoteMaybe.current
              : null;
        // When restoring from a backup, force the remote snapshot
        // to override local state even if its original timestamps
        // are older than the current data.
        if (fn) fn(snap, { force: true });
      }
      try { Sync.touchLocalUpdated?.(Date.now()); } catch {}
      await Sync.replaceRemoteSnapshot?.(snap);
      notify("Cloud replaced from backup", 1800);
    } catch (e) {
      console.warn("Restore failed", e);
      notify("Restore failed, check console", 2000);
    }
  }, [notify, applyRemoteMaybe]);

  return { packState, backupLocalSnapshot, restoreCloudFromLocalBackup };
}

