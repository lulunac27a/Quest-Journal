// src/app/app.remote.js
import { ts, mergeTasksByUpdatedAt, mergeCalendarEventsByUpdatedAt } from "./app.merge.js";
import { ensureListsPresent, coerceActiveId } from "./app.lists.js";
import { clearLocalStorageByPrefix } from "./app.helpers.js";
import { getItem as getUserItem, setItem as setUserItem } from "../core/userLocal.js";
import { readUpdatedAt as readDocLocalUpdated } from "../core/storage.js";
import { saveMultiXP } from "../core/multixp.js";
import { loadProfile, saveProfile, defaultProfile } from "../core/profile.js";
import { loadAllEntries as loadAllJournalEntries, saveEntry as saveJournalEntry } from "../utils/journalStore.js";
import * as Sync from "../sync/index.js";

export function createApplyRemote({
  activeListId,
  lists,
  day,
  week,
  setLists,
  setActiveListId,
  setTasks,
  setXp,
  setDailyTpl,
  setWeeklyTpl,
  setDay,
  setWeek,
  setAch,
  setOrigin,
  setSettings,
  setCalendarEvents,
  setProfileVersion,
}) {
  return (remote = {}, options = {}) => {
    const force = !!(options && options.force);

    const serverDocTsRaw = (() => {
      try {
        const a = ts(remote?.updatedAt);
        const b = ts(remote?.meta?.updatedAt);
        return Math.max(a, b, 0);
      } catch { return 0; }
    })();
    const LAST_SERVER_TS_KEY = "qj_last_server_doc_ts";
    const priorServerTs = (() => {
      try { return Number(getUserItem(LAST_SERVER_TS_KEY) || 0); } catch { return 0; }
    })();
    const remoteDocTsRaw = (() => {
      try {
        const a = ts(remote?.updatedAt);
        const b = ts(remote?.meta?.updatedAt);
        const c = Number(remote?.clientUpdatedAt || 0);
        const d = Number(remote?.metaClient?.clientUpdatedAt || 0);
        return Math.max(a, b, c, d, 0);
      } catch { return 0; }
    })();

    const forceTs = force ? Date.now() : 0;
    const serverDocTs = Math.max(serverDocTsRaw, forceTs);
    const remoteDocTs = Math.max(remoteDocTsRaw, forceTs);

    const localDocTs = (() => { try { return Number(readDocLocalUpdated() || 0); } catch { return 0; } })();
    let epochForcesTasksReset = false;
    try {
      const re = Number(remote?.resetEpoch || 0);
      const uid = (Sync.getUser?.() || {}).uid || "";
      if (uid && re) {
        const le = Number(localStorage.getItem(`qj_reset_epoch:${uid}`) || 0);
        epochForcesTasksReset = re > le;
      }
    } catch {}
    if (remote.lists) {
      const norm = ensureListsPresent(remote.lists);
      setLists(norm);
      const nextActive = coerceActiveId(remote.activeListId || activeListId, norm);
      setActiveListId(nextActive);
    } else if (remote.activeListId) {
      setActiveListId(prev => coerceActiveId(remote.activeListId, lists));
    }

    if (remote.tasks) {
      if (epochForcesTasksReset || force) {
        setTasks(Array.isArray(remote.tasks) ? remote.tasks : []);
        try {
          clearLocalStorageByPrefix("qj_stats_today_");
          clearLocalStorageByPrefix("qj_stats_week_");
        } catch {}
        try { localStorage.removeItem("qj_multi_xp_v1"); } catch {}
        try { localStorage.removeItem("qj_multixp_state_v1"); } catch {}
      } else {
        setTasks(prev => mergeTasksByUpdatedAt(prev, remote.tasks));
      }
    }

    // Always refresh legacy XP from remote when the remote doc
    // is at least as new as our local doc – or when a backup
    // restore explicitly forces it.
    if (Number.isFinite(remote.xp)) {
      if (force || remoteDocTs >= localDocTs) setXp(remote.xp);
    }
    if (remote.dailyTpl) setDailyTpl(remote.dailyTpl);
    if (remote.weeklyTpl) setWeeklyTpl(remote.weeklyTpl);

    if (remote.day && (force || ts(remote.day.updatedAt) > ts(day?.updatedAt))) setDay(remote.day);
    if (remote.week && (force || ts(remote.week.updatedAt) > ts(week?.updatedAt))) setWeek(remote.week);

    if (remote.ach) setAch(remote.ach);
    if (typeof remote.origin === "string") setOrigin(remote.origin);
    if (remote.settings && (force || serverDocTs > priorServerTs)) setSettings(remote.settings);

    if (remote.multiXp && typeof remote.multiXp === "object") {
      try {
        if (force || serverDocTs > priorServerTs) saveMultiXP(remote.multiXp);
        const prof = loadProfile() || {};
        const merged = { ...prof, multixp: { ...(prof.multixp || {}), ...(remote.multiXp || {}) } };
        saveProfile(merged);
        setProfileVersion && setProfileVersion(v => v + 1);
      } catch {}
    }

    if (remote.calendarEvents && Array.isArray(remote.calendarEvents)) {
      setCalendarEvents(prev => mergeCalendarEventsByUpdatedAt(prev, remote.calendarEvents));
    }

    if (remote.journals && typeof remote.journals === "object") {
      try {
        const localMap = (() => {
          try { return loadAllJournalEntries(); } catch { return {}; }
        })();
        const merged = { ...localMap };
        for (const [id, r] of Object.entries(remote.journals || {})) {
          if (!id || !r) continue;
          const l = localMap[id];
          const lt = ts(l?.meta?.updatedAt);
          const rt = ts(r?.meta?.updatedAt);
          if (!l || rt > lt || force) {
            const next = { ...l, ...r, id };
            merged[id] = next;
            try { saveJournalEntry(next); } catch {}
          }
        }
        try { window.dispatchEvent(new Event("qj:journal-updated")); } catch {}
      } catch {}
    }

    if (remote.profile) {
      const localProf = (() => { try { return loadProfile() || {}; } catch { return {}; } })();
      const finalProfile = { ...defaultProfile(), ...remote.profile };
      if ((!finalProfile.name || !String(finalProfile.name).trim()) && localProf?.name) {
        finalProfile.name = localProf.name;
      }
      saveProfile(finalProfile);
      setProfileVersion && setProfileVersion(v => v + 1);
    }
    try {
      if (force || serverDocTs > priorServerTs) {
        setUserItem(LAST_SERVER_TS_KEY, String(serverDocTs || Date.now()));
      }
    } catch {}
  };
}
