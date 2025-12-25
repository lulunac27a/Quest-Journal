// src/app/state/AppStateContext.jsx
import { createContext, useContext, useMemo } from "react";
import useAppState from "../useAppState.js";

const AppViewContext = createContext(null);
const AppDataContext = createContext(null);

export function AppStateProvider({ children }) {
  const state = useAppState();

  const {
    tab,
    setTab,
    settings,
    setSettings,
    level,
    into,
    span,
    nextIn,
    progressPct,
    celebrate,
    ach,
    anim,
    dismissAnim,
    symbols,
    addSymbol,
    addRandomSymbol,
    currentToast,
    settingsModalProps,
    profileModalProps,
    openSettingsModal,
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
    dailyTpl,
    setDailyTpl,
    weeklyTpl,
    setWeeklyTpl,
    day,
    setDay,
    week,
    setWeek,
    setAch,
    origin,
    setOrigin,
    enqueueToast,
    lastActionRef,
    profileVersion,
    setProfileVersion,
  } = state;

  const viewValue = useMemo(
    () => ({
      tab,
      setTab,
      settings,
      setSettings,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      ach,
      anim,
      dismissAnim,
      symbols,
      addSymbol,
      addRandomSymbol,
      currentToast,
      settingsModalProps,
      profileModalProps,
      openSettingsModal,
    }),
    [
      tab,
      setTab,
      settings,
      setSettings,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      ach,
      anim,
      dismissAnim,
      symbols,
      addSymbol,
      addRandomSymbol,
      currentToast,
      settingsModalProps,
      profileModalProps,
      openSettingsModal,
    ],
  );

  const dataValue = useMemo(
    () => ({
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
      settings,
      enqueueToast,
      addSymbol,
      addRandomSymbol,
      lastActionRef,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      profileVersion,
      setProfileVersion,
    }),
    [
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
      settings,
      enqueueToast,
      addSymbol,
      addRandomSymbol,
      lastActionRef,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      profileVersion,
      setProfileVersion,
    ],
  );

  return (
    <AppViewContext.Provider value={viewValue}>
      <AppDataContext.Provider value={dataValue}>
        {children}
      </AppDataContext.Provider>
    </AppViewContext.Provider>
  );
}

export function useAppView() {
  const ctx = useContext(AppViewContext);
  if (!ctx) throw new Error("useAppView must be used within AppStateProvider");
  return ctx;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppStateProvider");
  return ctx;
}
