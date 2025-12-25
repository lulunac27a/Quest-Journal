// src/app/state/useStoryTabState.js
import { useMemo } from "react";
import { useAppData } from "./AppStateContext.jsx";

export function useStoryTabState() {
  const {
    level,
    tasks,
    origin,
    setOrigin,
    profileVersion,
  } = useAppData();

  return useMemo(
    () => ({
      level,
      tasks,
      origin,
      setOrigin,
      profileVersion,
    }),
    [level, tasks, origin, setOrigin, profileVersion],
  );
}
