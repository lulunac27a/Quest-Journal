// src/app/state/useTasksTabState.js
import { useState } from "react";
import useTaskSelectors from "../../hooks/useTaskSelectors.js";
import useTaskReorder from "../../hooks/useTaskReorder.js";
import useTaskCrud from "../../hooks/useTaskCrud.js";
import useTaskComposer from "../../hooks/useTaskComposer.js";
import useChallengeCompletions from "../../hooks/useChallengeCompletions.js";
import {
  useComposerProps,
  useTaskRowHandlers,
  useReorderState,
  useListsState,
  useHeaderStats,
  useTasksTabProps,
} from "./taskViewModels.js";
import { useAppData, useAppView } from "./AppStateContext.jsx";

export function useTasksTabState() {
  const {
    lists,
    setLists,
    activeListId,
    setActiveListId,
    tasks,
    setTasks,
    xp,
    setXp,
    settings,
    dailyTpl,
    weeklyTpl,
    day,
    setDay,
    week,
    setWeek,
    ach,
    origin,
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
  } = useAppData();
  const { openSettingsModal } = useAppView();

  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const composer = useTaskComposer();
  const {
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
    composerInputs,
  } = composer;

  const {
    reorderActive,
    reSrcId,
    reOverId,
    beginReorder,
    hoverReorder,
    clickReorderTarget,
  } = useTaskReorder(tasks, setTasks);
  const selectors = useTaskSelectors(tasks, activeListId, reorderActive);
  const {
    addTask,
    onAddSubtask,
    onRenameTitle,
    onUpdateTask,
    toggleTask,
    removeTaskWithConfirm,
    markMilestoneDone,
  } = useTaskCrud({
    tasks,
    setTasks,
    setXp,
    enqueueToast,
    lastActionRef,
    addRandomSymbol,
    activeListId,
    level,
    xp,
    composerInputs,
    soundsEnabled: settings?.sounds !== false,
  });

  const composerProps = useComposerProps({
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
  });

  const reorderState = useReorderState({
    reorderActive,
    reSrcId,
    reOverId,
    beginReorder,
    hoverReorder,
    clickReorderTarget,
  });

  const listsState = useListsState({
    lists,
    activeListId,
    setActiveListId,
    setLists,
    listMenuOpen,
    setListMenuOpen,
  });

  const headerStats = useHeaderStats({
    xp,
    level,
    into,
    span,
    nextIn,
    progressPct,
    celebrate,
    ach,
    origin,
    onOpenSettings: openSettingsModal,
  });

  const completePick = useChallengeCompletions({
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
    soundsEnabled: settings?.sounds !== false,
  });

  const taskRowHandlers = useTaskRowHandlers({
    toggleTask,
    removeTaskWithConfirm,
    onAddSubtask,
    markMilestoneDone,
    onRenameTitle,
    onUpdateTask,
  });

  return useTasksTabProps({
    headerStats,
    listsState,
    composerProps,
    addTask,
    rootsOpen: selectors.rootsOpen,
    rootsDone: selectors.rootsDone,
    childrenOf: selectors.childrenOf,
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
  });
}
