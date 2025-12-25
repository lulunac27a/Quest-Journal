// src/app/useAppPersistence.js
import usePersist from "../hooks/usePersist.js";
import { loadXP } from "../core/storage.js";
import {
  loadDailyTemplates,
  loadWeeklyTemplates,
  ensureTodayState,
  ensureWeekState,
} from "../core/challenges.js";
import {
  loadAchievements,
  saveAchievements,
  reconcileAchievementsWithCatalog,
  ACH_CATALOG,
} from "../core/achievements.js";
import {
  loadInitialActiveListId,
  loadInitialLists,
  loadInitialTasks,
} from "./app.helpers.js";

export default function useAppPersistence() {
  const [lists, setLists] = usePersist("qj_lists", loadInitialLists);
  const [activeListId, setActiveListId] = usePersist(
    "qj_active_list",
    loadInitialActiveListId,
  );
  const [tasks, setTasks] = usePersist("qj_tasks", loadInitialTasks);
  const [xp, setXp] = usePersist("qj_xp", loadXP);
  const [calendarEvents, setCalendarEvents] = usePersist(
    "qj_calendar_events",
    () => [],
  );
  const [settings, setSettings] = usePersist("qj_settings_v1", () => ({
    dark: false,
    animations: true,
    sounds: true,
    skin: "fairy",
    aiMode: "epic",
  }));
  const [dailyTpl, setDailyTpl] = usePersist(
    "qj_daily_tpl",
    loadDailyTemplates,
  );
  const [weeklyTpl, setWeeklyTpl] = usePersist(
    "qj_weekly_tpl",
    loadWeeklyTemplates,
  );
  const [day, setDay] = usePersist("qj_day_state", () => ({
    ...ensureTodayState(loadDailyTemplates()),
    updatedAt: Date.now(),
  }));
  const [week, setWeek] = usePersist("qj_week_state", () => ({
    ...ensureWeekState(loadWeeklyTemplates()),
    updatedAt: Date.now(),
  }));
  const [ach, setAch] = usePersist("qj_ach", () => {
    const reconciled = reconcileAchievementsWithCatalog(
      loadAchievements(),
      ACH_CATALOG,
    );
    try {
      saveAchievements(reconciled);
    } catch {}
    return reconciled;
  });
  const [origin, setOrigin] = usePersist("qj_story_origin", () => "");

  return {
    lists,
    setLists,
    activeListId,
    setActiveListId,
    tasks,
    setTasks,
    xp,
    setXp,
    calendarEvents,
    setCalendarEvents,
    settings,
    setSettings,
    dailyTpl,
    setDailyTpl,
    weeklyTpl,
    setWeeklyTpl,
    day,
    setDay,
    week,
    setWeek,
    ach,
    setAch,
    origin,
    setOrigin,
  };
}

