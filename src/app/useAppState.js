import { useCallback, useRef, useState } from "react";
import useProfileGate from "../hooks/useProfileGate.js";
import useLevelProgress from "../hooks/useLevelProgress.js";
import useJournalBridge from "../hooks/useJournalBridge.js";
import useAchievementsFlow from "../hooks/useAchievementsFlow.js";
import useRollover from "../hooks/useRollover.js";
import useTaskGc from "../hooks/useTaskGc.js";
import useToastQueue from "../hooks/useToastQueue.js";
import useTouchClass from "../hooks/useTouchClass.js";
import useTheme from "../hooks/useTheme.js";
import useBackup from "../hooks/useBackup.js";
import useSymbols from "../hooks/useSymbols.js";
import useStaySignedInPreference from "../hooks/useStaySignedInPreference.js";
import { createResetHandlers } from "./app.reset.js";
import useAppCloudBridge from "./useAppCloudBridge.js";
import useAppPersistence from "./useAppPersistence.js";
import * as Sync from "../sync/index.js";
import {
  useProfileModalProps,
  useSettingsModalProps,
} from "./state/modalViewModels.js";

export default function useAppState() {
  const [tab, setTab] = useState("tasks");
  useTouchClass();
  const {
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
  } = useAppPersistence();
  const lastActionRef = useRef(null);
  const { currentToast, enqueueToast } = useToastQueue(1500);
  const { symbols, addSymbol, addRandomSymbol, resetSymbols } = useSymbols();
  const { level, into, span, nextIn, progressPct, celebrate } = useLevelProgress(
    xp,
    settings.animations,
  );

  const [profileVersion, setProfileVersion] = useState(0);
  const profileGate = useProfileGate({ enqueueToast, setProfileVersion });
  const [staySignedIn, setStaySignedInPref] = useStaySignedInPreference();
  const {
    profileOpen,
    setProfileOpen,
    profileName,
    setProfileName,
    saveProfileName,
  } = profileGate;

  const { anim, dismissAnim, resetAnimState } = useAchievementsFlow(
    { tasks, level, ach, settings },
    { setAch, setXp },
    lastActionRef,
  );
  const journalTick = useJournalBridge(lastActionRef);
  const applyRemoteRef = useRef(null);
  const { packState, backupLocalSnapshot, restoreCloudFromLocalBackup } =
    useBackup(
      {
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
        calendarEvents,
      },
      { enqueueToast },
      applyRemoteRef,
    );
  const [settingsOpen, setSettingsOpen] = useState(false);
  useRollover({ setDay, setWeek, dailyTpl, weeklyTpl });
  useTheme(settings);
  useTaskGc(tasks, setTasks);

  const { resetLocalToDefaults, hardResetAccount, resetCloudAccount } =
    createResetHandlers({
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
      resetSymbols,
      resetAnimState,
      setProfileVersion,
      enqueueToast,
    });

  const cloudBridge = useAppCloudBridge({
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
    });

  const {
    ready: fbReady,
    user,
    busy: cloudBusy,
    error: cloudError,
    signIn: doSignIn,
    signOut: doSignOut,
  } = cloudBridge;
  const doEmailSignUp = useCallback(
    (email, password) => Sync.signUpWithEmail?.(email, password),
    [],
  );
  const doEmailSignIn = useCallback(
    (email, password) => Sync.signInWithEmail?.(email, password),
    [],
  );

  const onCloudPull = useCallback(() => {
    try {
      Sync.pullNow?.();
      enqueueToast("Pulled from cloud", 1200);
    } catch {}
  }, [enqueueToast]);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeProfile = useCallback(() => setProfileOpen(false), [setProfileOpen]);

  const settingsModalProps = useSettingsModalProps({
    settingsOpen,
    closeSettings,
    settings,
    setSettings,
    dailyTpl,
    setDailyTpl,
    weeklyTpl,
    setWeeklyTpl,
    fbReady,
    user,
    cloudBusy,
    cloudError,
    doSignIn,
    doSignOut,
    hardResetAccount,
    resetCloudAccount,
    profileName,
    setProfileName,
    saveProfileName,
    onCloudPull,
    backupLocalSnapshot,
    restoreCloudFromLocalBackup,
    onEmailSignUp: doEmailSignUp,
    onEmailSignIn: doEmailSignIn,
    staySignedIn,
    setStaySignedInPreference: setStaySignedInPref,
  });

  const profileModalProps = useProfileModalProps({
    profileOpen,
    profileName,
    setProfileName,
    saveProfileName,
    closeProfile,
  });

  return {
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
    enqueueToast,
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
    settingsModalProps,
    profileModalProps,
    openSettingsModal: openSettings,
    lastActionRef,
    addRandomSymbolRef: addRandomSymbol,
    profileVersion,
    setProfileVersion,
  };
}
