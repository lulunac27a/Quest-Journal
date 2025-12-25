// src/hooks/useChallengeCompletions.js
import { useCallback } from "react";
import { DEFAULT_DAILY_XP, DEFAULT_WEEKLY_XP } from "../core/challenges.js";
import { playRandomSfx } from "../utils/sfx.js";

export default function useChallengeCompletions({
  day,
  week,
  setDay,
  setWeek,
  dailyTpl,
  weeklyTpl,
  setXp,
  enqueueToast,
  addSymbol,
  lastActionRef,
  soundsEnabled = true,
}) {
  const dayCompletedIds = day?.completedIds || [];
  const weekCompletedIds = week?.completedIds || [];

  return useCallback(({ kind, tplId }) => {
    if (kind === "daily") {
      if (dayCompletedIds.includes(tplId)) return;
      lastActionRef.current = "daily";
      setDay((st) => ({ ...st, completedIds: [...st.completedIds, tplId], updatedAt: Date.now() }));
      setXp((x) => x + (dailyTpl.find((t) => t.id === tplId)?.xp ?? DEFAULT_DAILY_XP));
      if (soundsEnabled) playRandomSfx();
      enqueueToast("✨ Daily complete!", 1200);
      addSymbol && addSymbol("✨");
    } else if (kind === "weekly") {
      if (weekCompletedIds.includes(tplId)) return;
      lastActionRef.current = "weekly";
      setWeek((st) => ({ ...st, completedIds: [...st.completedIds, tplId], updatedAt: Date.now() }));
      setXp((x) => x + (weeklyTpl.find((t) => t.id === tplId)?.xp ?? DEFAULT_WEEKLY_XP));
      if (soundsEnabled) playRandomSfx();
      enqueueToast("🔥 Weekly complete!", 1200);
      addSymbol && addSymbol("🔥");
    }
  }, [
    dayCompletedIds,
    weekCompletedIds,
    dailyTpl,
    weeklyTpl,
    setDay,
    setWeek,
    setXp,
    enqueueToast,
    addSymbol,
    lastActionRef,
    soundsEnabled,
  ]);
}
