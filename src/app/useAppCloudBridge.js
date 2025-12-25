// src/app/useAppCloudBridge.js
import { useCallback, useEffect, useRef } from "react";
import { createApplyRemote } from "./app.remote.js";
import useCloudBridge from "../hooks/useCloudBridge.js";

export default function useAppCloudBridge({
  lists,
  activeListId,
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
  packState,
  applyRemoteRef,
  resetLocalToDefaults,
  tasks,
  xp,
  dailyTpl,
  weeklyTpl,
  ach,
  origin,
  settings,
  profileVersion,
  calendarEvents,
  journalTick,
}) {
  const latestStateRef = useRef({
    lists,
    activeListId,
    day,
    week,
  });

  useEffect(() => {
    latestStateRef.current = {
      lists,
      activeListId,
      day,
      week,
    };
  }, [lists, activeListId, day, week]);

  const applyRemote = useCallback(
    (remote) => {
      const snapshot = latestStateRef.current;
      const handler = createApplyRemote({
        ...snapshot,
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
      });
      return handler(remote);
    },
    [
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
    ],
  );

  const pushDeps = [
    lists,
    activeListId,
    tasks,
    xp,
    dailyTpl,
    weeklyTpl,
    day,
    week,
    ach,
    origin,
    settings,
    profileVersion,
    calendarEvents,
    journalTick,
  ];

  return useCloudBridge({
    applyRemote,
    applyRemoteRef,
    packState,
    pushDeps,
    activeListId,
    resetLocalToDefaults,
  });
}
