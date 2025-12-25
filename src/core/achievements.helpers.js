// src/core/achievements.helpers.js
// ─────────────────────────────────────────────────────────────
// توابع عمومی برای تاریخ و ریست اچیومنت‌ها
// ─────────────────────────────────────────────────────────────

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function weekKeyOf(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Reset helpers
// ─────────────────────────────────────────────────────────────

import { getItem as getItemu, setItem as setItemu, getJSON as getJSONu, setJSON as setJSONu } from "./userLocal.js";

export function resetDailyAchievements() {
  try {
    const key = "qj_daily_reset_key";
    const today = todayISO();
    const last = getItemu(key);
    if (last !== today) {
      const ach = getJSONu("qj_ach_v2", null);
      if (ach?.unlocked?.length) {
        ach.unlocked = ach.unlocked.filter(a => a.type !== "daily");
        setJSONu("qj_ach_v2", ach);
      }
      setItemu(key, today);
    }
  } catch (e) {
    console.warn("Daily reset failed:", e);
  }
}

export function resetWeeklyAchievements() {
  try {
    const key = "qj_weekly_reset_key";
    const current = weekKeyOf();
    const last = getItemu(key);
    if (last !== current) {
      const ach = getJSONu("qj_ach_v2", null);
      if (ach?.unlocked?.length) {
        ach.unlocked = ach.unlocked.filter(a => a.type !== "weekly");
        setJSONu("qj_ach_v2", ach);
      }
      setItemu(key, current);
    }
  } catch (e) {
    console.warn("Weekly reset failed:", e);
  }
}
