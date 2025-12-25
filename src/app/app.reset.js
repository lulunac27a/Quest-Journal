// src/app/app.reset.js
import { loadDailyTemplates, loadWeeklyTemplates, ensureTodayState, ensureWeekState } from "../core/challenges.js";
import { loadAchievements, reconcileAchievementsWithCatalog, ACH_CATALOG } from "../core/achievements.js";
import { DEFAULT_LISTS } from "./app.constants.js";
import { makeEmptyAchievements, clearLocalStorageByPrefix } from "./app.helpers.js";
import { loadProfile, saveProfile } from "../core/profile.js";
import { removeAllForCurrentUser as wipeUserLocal } from "../core/userLocal.js";
import { deleteJournalDB } from "../utils/journalStore.js";
import * as Sync from "../sync/index.js";

export function createResetHandlers({
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
  resetSymbols,
  resetAnimState,
  setProfileVersion,
  enqueueToast,
}) {
  function packDefaultState(opts = {}) {
    const { achMode = "fromStorage" } = opts; // "empty" | "fromStorage"
    const baseDaily = loadDailyTemplates();
    const baseWeekly = loadWeeklyTemplates();
    const nowTs = Date.now();
    return {
      v: 1,
      updatedAt: nowTs,
      meta: { updatedAt: nowTs }, // compat for older builds
      lists: DEFAULT_LISTS,
      activeListId: "main",
      tasks: [],
      xp: 0,
      dailyTpl: baseDaily,
      weeklyTpl: baseWeekly,
      day: { ...ensureTodayState(baseDaily), updatedAt: nowTs },
      week: { ...ensureWeekState(baseWeekly), updatedAt: nowTs },
      calendarEvents: [],
      ach: achMode === "empty"
        ? makeEmptyAchievements()
        : reconcileAchievementsWithCatalog(loadAchievements(), ACH_CATALOG),
      origin: "",
      settings: { dark: false, animations: true, sounds: true, skin: "fairy", aiMode: "epic" },
      profile: loadProfile() || {},
    };
  }

  function resetLocalToDefaults() {
    const d = packDefaultState({ achMode: "empty" });
    setLists(d.lists);
    setActiveListId(d.activeListId);
    setTasks(d.tasks);
    setXp(d.xp);
    setDailyTpl(d.dailyTpl);
    setWeeklyTpl(d.weeklyTpl);
    setDay(d.day);
    setWeek(d.week);
    setCalendarEvents(d.calendarEvents);
    setAch(d.ach);
    setOrigin(d.origin);
    setSettings(d.settings);
    saveProfile(d.profile);
  }

  async function hardResetAccount() {
    try { wipeUserLocal(); } catch {}
    try { await deleteJournalDB(); } catch {}
    try { clearLocalStorageByPrefix("qj_stats_today_"); } catch {}
    try { clearLocalStorageByPrefix("qj_stats_week_"); } catch {}
    try { localStorage.removeItem("qj_multixp_state_v1"); } catch {}
    try { localStorage.removeItem("qj_multi_xp_v1"); } catch {}
    try { localStorage.removeItem("qj_ach_v2"); } catch {}

    const baseDaily = loadDailyTemplates();
    const baseWeekly = loadWeeklyTemplates();
    const emptyAch = makeEmptyAchievements();

    try {
      const prev = loadProfile() || {};
      saveProfile({
        name: prev?.name || "",
        multixp: { xp: {}, lastDecayDate: null, version: 1 },
        perks: { owned: [] },
        events: { seen: [] },
        meta: { streak: 0, lastActiveDate: null, version: 1 },
        lifetime: { doneByBranch: {} },
        createdAt: prev.createdAt || new Date().toISOString(),
        updatedAt: Date.now(),
      });
    } catch {}

    setLists(DEFAULT_LISTS);
    setActiveListId("main");
    setTasks([]);
    setXp(0);

    setDailyTpl(baseDaily);
    setWeeklyTpl(baseWeekly);
    const freshDay = { ...ensureTodayState(baseDaily), completedIds: [], updatedAt: Date.now() };
    const freshWeek = { ...ensureWeekState(baseWeekly), completedIds: [], updatedAt: Date.now() };
    setDay(freshDay);
    setWeek(freshWeek);
    setCalendarEvents([]);

    setAch(emptyAch);
    setOrigin("");
    setSettings({ dark: false, animations: true, sounds: true, skin: "fairy", aiMode: "epic" });
    resetSymbols && resetSymbols();
    resetAnimState && resetAnimState();
    setProfileVersion && setProfileVersion(v => v + 1);

    try {
      const curUser = (Sync.getUser?.() || {}).uid || "";
      if (curUser) {
        Promise.resolve().then(async () => {
          try { await (Sync.resetRemoteDeleteAll?.() ?? Promise.resolve()); }
          catch (e) { console.warn("Cloud reset after local reset failed:", e); }
        });
      }
    } catch {}
  }

  async function resetCloudAccount() {
    try {
      await hardResetAccount();
      enqueueToast && enqueueToast("Account fully reset (cloud + local)", 1500);
    } catch (e) {
      console.warn("Unified reset failed:", e);
      enqueueToast && enqueueToast("Reset failed", 1500);
    }
  }

  return { packDefaultState, resetLocalToDefaults, hardResetAccount, resetCloudAccount };
}
