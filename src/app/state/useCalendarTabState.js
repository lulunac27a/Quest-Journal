// src/app/state/useCalendarTabState.js
import { useMemo } from "react";
import { useAppData } from "./AppStateContext.jsx";

export function useCalendarTabState() {
  const {
    tasks,
    setTasks,
    activeListId,
    lists,
    calendarEvents,
    setCalendarEvents,
  } = useAppData();

  return useMemo(
    () => ({
      tasks,
      setTasks,
      activeListId,
      lists,
      calendarEvents,
      setCalendarEvents,
    }),
    [tasks, setTasks, activeListId, lists, calendarEvents, setCalendarEvents],
  );
}
