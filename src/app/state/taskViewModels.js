import { useMemo } from "react";
import { uid } from "../../utils/constants.js";

export function useComposerProps({
  text,
  setText,
  aiText,
  setAiText,
  xpInput,
  setXpInput,
  deadlineAmt,
  setDeadlineAmt,
  deadlineUnit,
  setDeadlineUnit,
  setAbsoluteDue,
  desc,
  setDesc,
  recur,
  setRecur,
  recurCustom,
  setRecurCustom,
  recurWeeklyDays,
  setRecurWeeklyDays,
}) {
  return useMemo(
    () => ({
      text,
      setText,
      aiText,
      setAiText,
      xpInput,
      setXpInput,
      deadlineAmt,
      setDeadlineAmt,
      deadlineUnit,
      setDeadlineUnit,
      setAbsoluteDue,
      desc,
      setDesc,
      recur,
      setRecur,
      recurCustom,
      setRecurCustom,
      recurWeeklyDays,
      setRecurWeeklyDays,
    }),
    [
      text,
      setText,
      aiText,
      setAiText,
      xpInput,
      setXpInput,
      deadlineAmt,
      setDeadlineAmt,
      deadlineUnit,
      setDeadlineUnit,
      setAbsoluteDue,
      desc,
      setDesc,
      recur,
      setRecur,
      recurCustom,
      setRecurCustom,
      recurWeeklyDays,
      setRecurWeeklyDays,
    ],
  );
}

export function useTaskRowHandlers({
  toggleTask,
  removeTaskWithConfirm,
  onAddSubtask,
  markMilestoneDone,
  onRenameTitle,
  onUpdateTask,
}) {
  return useMemo(
    () => ({
      toggleTask,
      removeTaskWithConfirm,
      onAddSubtask,
      markMilestoneDone,
      onRenameTitle,
      onUpdateTask,
    }),
    [
      toggleTask,
      removeTaskWithConfirm,
      onAddSubtask,
      markMilestoneDone,
      onRenameTitle,
      onUpdateTask,
    ],
  );
}

export function useReorderState({
  reorderActive,
  reSrcId,
  reOverId,
  beginReorder,
  hoverReorder,
  clickReorderTarget,
}) {
  return useMemo(
    () => ({
      reorderActive,
      reSrcId,
      reOverId,
      beginReorder,
      hoverReorder,
      clickReorderTarget,
    }),
    [
      reorderActive,
      reSrcId,
      reOverId,
      beginReorder,
      hoverReorder,
      clickReorderTarget,
    ],
  );
}

export function useListsState({
  lists,
  activeListId,
  setActiveListId,
  setLists,
  listMenuOpen,
  setListMenuOpen,
}) {
  return useMemo(
    () => ({
      lists,
      activeListId,
      setActiveListId,
      setLists,
      listMenuOpen,
      setListMenuOpen,
      uid,
    }),
    [lists, activeListId, setActiveListId, setLists, listMenuOpen, setListMenuOpen],
  );
}

export function useHeaderStats({
  xp,
  level,
  into,
  span,
  nextIn,
  progressPct,
  celebrate,
  ach,
  origin,
  onOpenSettings,
}) {
  return useMemo(
    () => ({
      xp,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      ach,
      origin,
      onOpenSettings,
    }),
    [
      xp,
      level,
      into,
      span,
      nextIn,
      progressPct,
      celebrate,
      ach,
      origin,
      onOpenSettings,
    ],
  );
}

export function useTasksTabProps({
  headerStats,
  listsState,
  composerProps,
  addTask,
  rootsOpen,
  rootsDone,
  childrenOf,
  taskRowHandlers,
  reorderState,
  settings,
  setTasks,
  day,
  setDay,
  dailyTpl,
  week,
  setWeek,
  weeklyTpl,
  completePick,
  completedOpen,
  setCompletedOpen,
}) {
  return useMemo(
    () => ({
      headerStats,
      listsState,
      composer: composerProps,
      addTask,
      rootsOpen,
      rootsDone,
      childrenOf,
      taskRowHandlers,
      reorderState,
      settings,
      setTasks,
      day,
      setDay,
      dailyTpl,
      week,
      setWeek,
      weeklyTpl,
      completePick,
      completedOpen,
      setCompletedOpen,
    }),
    [
      headerStats,
      listsState,
      composerProps,
      addTask,
      rootsOpen,
      rootsDone,
      childrenOf,
      taskRowHandlers,
      reorderState,
      settings,
      setTasks,
      day,
      setDay,
      dailyTpl,
      week,
      setWeek,
      weeklyTpl,
      completePick,
      completedOpen,
      setCompletedOpen,
    ],
  );
}

export function useCalendarTabProps({
  tasks,
  setTasks,
  activeListId,
  lists,
  calendarEvents,
  setCalendarEvents,
}) {
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

export function useStoryTabProps({
  level,
  tasks,
  origin,
  setOrigin,
  profileVersion,
}) {
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
