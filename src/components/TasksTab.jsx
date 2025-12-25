// src/components/TasksTab.jsx
import AppHeader from "./AppHeader.jsx";
import TopAchievements from "./TopAchievements.jsx";
import ListsToolbar from "./ListsToolbar.jsx";
import AddTaskBar from "./AddTaskBar.jsx";
import Counters from "./Counters.jsx";
import TaskRow from "./TaskRow.jsx";
import InboxLibrary from "./InboxLibrary.jsx";
import ChallengeSection from "./ChallengeSection.jsx";
import XpMicroOverlay from "./XpMicroOverlay.jsx";
import { timeLeft } from "../utils/time.js";
import useTick from "../hooks/useTick.js";
import { useTasksTabState } from "../app/state/useTasksTabState.js";
import {
  DEFAULT_DAILY_XP,
  DEFAULT_WEEKLY_XP,
  dayNameOf,
  weekKeyOf,
} from "../core/challenges.js";

export default function TasksTab({
  headerStats,
  listsState,
  composer,
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
  const now = useTick(1000);
  const {
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
  } = headerStats;
  const {
    lists,
    activeListId,
    setActiveListId,
    setLists,
    listMenuOpen,
    setListMenuOpen,
    uid,
  } = listsState;
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
  } = composer;
  const {
    toggleTask,
    removeTaskWithConfirm,
    onAddSubtask,
    markMilestoneDone,
    onRenameTitle,
    onUpdateTask,
  } = taskRowHandlers;
  const { reorderActive, reSrcId, reOverId, beginReorder, hoverReorder, clickReorderTarget } =
    reorderState;
  const showInboxLibrary = activeListId === "inbox";
  const clearCompleted = () =>
    setTasks((p) =>
      p.filter(
        (t) => !(t.done && t.listId === activeListId && !t.parentId),
      ),
    );

  return (
    <div className="card">
      <XpMicroOverlay />
      <div>
        <AppHeader
          xp={xp}
          level={level}
          into={into}
          span={span}
          nextIn={nextIn}
          progressPct={progressPct}
          ach={ach}
          celebrate={celebrate}
          onOpenSettings={onOpenSettings}
          origin={origin}
        />
        <TopAchievements ach={ach} />
        <ListsToolbar
          lists={lists}
          activeListId={activeListId}
          setActiveListId={setActiveListId}
          listMenuOpen={listMenuOpen}
          setListMenuOpen={setListMenuOpen}
          setLists={setLists}
          setTasks={setTasks}
          uid={uid}
        />
        {!showInboxLibrary && (
          <AddTaskBar
            text={text}
            setText={setText}
            aiText={aiText}
            setAiText={setAiText}
            xpInput={xpInput}
            setXpInput={setXpInput}
            deadlineAmt={deadlineAmt}
            setDeadlineAmt={setDeadlineAmt}
            deadlineUnit={deadlineUnit}
            setDeadlineUnit={setDeadlineUnit}
            setAbsoluteDue={setAbsoluteDue}
            desc={desc}
            setDesc={setDesc}
            recur={recur}
            setRecur={setRecur}
            recurCustom={recurCustom}
            setRecurCustom={setRecurCustom}
            recurWeeklyDays={recurWeeklyDays}
            setRecurWeeklyDays={setRecurWeeklyDays}
            onAdd={addTask}
            level={level}
            aiMode={settings.aiMode || "epic"}
          />
        )}
        {!showInboxLibrary && (
          <Counters
            rootsOpenCount={rootsOpen.length}
            rootsDoneCount={rootsDone.length}
          />
        )}
        {showInboxLibrary ? (
          <InboxLibrary
            lists={lists}
            activeListId={activeListId}
            onActivate={addTask}
          />
        ) : (
          <section className="list">
            {rootsOpen.length === 0 && (
              <div className="empty">No tasks yet - add one to earn XP!</div>
            )}
            {rootsOpen.map((t) => (
              <TaskRow
                key={t.id}
                t={t}
                childrenOf={childrenOf}
                onToggle={toggleTask}
                onRemove={removeTaskWithConfirm}
                onAddSubtask={onAddSubtask}
                onMilestoneToggle={markMilestoneDone}
                onRenameTitle={onRenameTitle}
                onUpdate={onUpdateTask}
                lists={lists}
                draggable={false}
                onRowDblClick={beginReorder}
                onRowHover={hoverReorder}
                onRowClickTarget={clickReorderTarget}
                reorderActive={reorderActive}
                isReorderSrc={reSrcId === t.id}
                isDragOver={reorderActive && reOverId === t.id}
                aiMode={settings.aiMode || "epic"}
                timeLeft={(iso) => timeLeft(iso, now)}
              />
            ))}
          </section>
        )}
        {!showInboxLibrary && (
          <section className="list" style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, marginBottom: 8 }}>
                  {"\u2705"} Completed
                </h3>
                <button
                  aria-label="toggle completed"
                  onClick={() => setCompletedOpen((v) => !v)}
                  className={`tap-ctl chk-ctrl ${completedOpen ? "on on-green" : ""}`}
                />
              </div>
              <button
                className="btn"
                onClick={clearCompleted}
                disabled={rootsDone.length === 0}
                style={{ marginBottom: 4 }}
              >
                Clear completed
              </button>
            </div>
            {completedOpen && rootsDone.length === 0 && (
              <div className="empty">Nothing here yet.</div>
            )}
            {completedOpen &&
              rootsDone.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  childrenOf={childrenOf}
                  onToggle={toggleTask}
                  onRemove={removeTaskWithConfirm}
                  onAddSubtask={onAddSubtask}
                  onMilestoneToggle={markMilestoneDone}
                  onRenameTitle={onRenameTitle}
                  onUpdate={onUpdateTask}
                  lists={lists}
                  draggable={false}
                  aiMode={settings.aiMode || "epic"}
                  timeLeft={(iso) => timeLeft(iso, now)}
                />
              ))}
          </section>
        )}
        <ChallengeSection
          title={`${"\u2728"} Today's Challenges`}
          hint={`(${dayNameOf(undefined, "en-US")})`}
          open={day.__open !== false}
          onToggle={() =>
            setDay((st) => ({
              ...st,
              __open: st.__open === false,
              updatedAt: Date.now(),
            }))
          }
          picks={day.picks}
          templates={dailyTpl}
          completedIds={day.completedIds || []}
          onComplete={(tplId) => completePick({ kind: "daily", tplId })}
          xpFallback={DEFAULT_DAILY_XP}
          emptyMessage="No templates yet - add some in settings."
          containerStyle={{ marginTop: 24 }}
          toggleClassName="on on-blue"
          sectionClassName="daily-challenges"
        />
        <ChallengeSection
          title={`${"\u{1F4C6}"} Weekly Challenges`}
          hint={`(${weekKeyOf()})`}
          open={week.__open !== false}
          onToggle={() =>
            setWeek((st) => ({
              ...st,
              __open: st.__open === false,
              updatedAt: Date.now(),
            }))
          }
          picks={week.picks}
          templates={weeklyTpl}
          completedIds={week.completedIds || []}
          onComplete={(tplId) => completePick({ kind: "weekly", tplId })}
          xpFallback={DEFAULT_WEEKLY_XP}
          emptyMessage="No templates yet - add some in settings."
          containerStyle={{ marginTop: 16 }}
          toggleClassName="on on-amber"
          sectionClassName="weekly-challenges"
        />
      </div>
    </div>
  );
}

export function TasksTabPanel() {
  const props = useTasksTabState();
  return <TasksTab {...props} />;
}
