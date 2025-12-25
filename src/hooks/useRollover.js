// src/hooks/useRollover.js
import { useEffect } from "react";
import { ensureTodayState, ensureWeekState, todayStr, weekKeyOf } from "../core/challenges.js";

const ROLLOVER_CHECK_MS = 60 * 1000;

export default function useRollover({ setDay, setWeek, dailyTpl, weeklyTpl }) {
  useEffect(() => {
    const run = () => {
      try {
        setDay((st) => {
          if (st && st.date === todayStr()) return st;
          return { ...ensureTodayState(dailyTpl), updatedAt: Date.now() };
        });
      } catch {}
      try {
        const wk = weekKeyOf();
        setWeek((st) => {
          if (st && st.weekKey === wk) return st;
          return { ...ensureWeekState(weeklyTpl), updatedAt: Date.now() };
        });
      } catch {}
    };
    run();
    const intervalId = setInterval(run, ROLLOVER_CHECK_MS);
    return () => clearInterval(intervalId);
  }, [setDay, setWeek, dailyTpl, weeklyTpl]);
}
