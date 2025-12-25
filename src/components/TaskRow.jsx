import React, { useCallback, useMemo, useRef, useState } from "react";
import TaskNotes from "./TaskNotes.jsx";
import TaskEditDialog from "./TaskEditDialog.jsx";
import ChildItem from "./TaskRow.ChildItem.jsx";
import { SubAddModal } from "./TaskRow.SubAddModal.jsx";
import { percentMilestones } from "./TaskRow.helpers.js";
import { epicifyTask } from "../utils/ai.js";
import { QUEST_TYPES } from "../core/constants.js";
import useClickOutside from "../hooks/useClickOutside.js";

export default function TaskRow({
  t,
  childrenOf,
  onToggle,
  onRemove,
  onAddSubtask,
  onMilestoneToggle,
  onUpdate,
  timeLeft,
  lastBoost,
  lists = [],
}) {
  const kidsSorted = childrenOf(t.id) || [];

  const [addDlgOpen, setAddDlgOpen] = useState(false);
  const [liveDesc, setLiveDesc] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  const deadlineText = t.done ? null : timeLeft(t.deadline);
  const questTypeKey = ((t?.questType ?? "BASIC").toString().toUpperCase());
  const q = QUEST_TYPES[questTypeKey] || QUEST_TYPES.BASIC;

  const pct = useMemo(() => percentMilestones(t), [t?.subtasks]);
  const milestones = useMemo(
    () => (Array.isArray(t?.subtasks) ? t.subtasks.filter((s) => s?.isMilestone) : []),
    [t?.subtasks]
  );

  const parentBase = useMemo(() => Math.max(1, parseInt(t?.baseXp ?? t?.xp ?? 1, 10) || 1), [t?.baseXp, t?.xp]);
  const usedPct = useMemo(() => {
    if (!parentBase) return 0;
    const sum = (kidsSorted || []).reduce((acc, c) => acc + Math.max(1, parseInt(c?.xp || 1, 10)), 0);
    return Math.round((sum / parentBase) * 100);
  }, [kidsSorted, parentBase]);
  const totalCapLeft = Math.max(0, 200 - usedPct);
  const perCap = Math.max(0, Math.min(99, totalCapLeft));

  async function aiForThis() {
    try {
      setIsStreaming(true);
      let final = "";
      await epicifyTask(t.title, t.desc || "", {
        stream: true,
        onToken: (_tok, full) => { setLiveDesc(full); final = full; },
      });
      onUpdate?.(t.id, { desc: final });
    } catch (e) { alert("AI failed: " + e.message); }
    finally { setIsStreaming(false); }
  }

  const handleSubtaskSubmit = ({ title, percent, forceOne }) => {
    if (forceOne || totalCapLeft <= 0) {
      onAddSubtask(t.id, title, 1, () => setAddDlgOpen(false));
      return;
    }
    const p = Math.max(1, Math.min(99, percent, perCap));
    onAddSubtask(t.id, title, `${p}%`, () => setAddDlgOpen(false));
  };

  const canEdit = !t.done;

  return (
    <div className={`task ${t.done ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={t.done}
        onChange={() => onToggle(t.id)}
        aria-label="Toggle task done"
        data-xp-anchor={t.id}
      />

      <div className="title">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>{t.title}</div>
          <span className="badge" title="Quest type" style={{ whiteSpace: "nowrap" }}>{q.label}</span>
          {!t.parentId && !t.done && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <button className="icon-btn" title="More" onClick={() => setMenuOpen(v => !v)} type="button" aria-haspopup aria-expanded={menuOpen}>...</button>
              {menuOpen && (
                <div role="menu" style={{ position: "absolute", right: 0, top: "110%", zIndex: 40, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 10px 26px rgba(0,0,0,.12)", minWidth: 160, padding: 6, display: "grid", gap: 6 }}>
                  <button className="btn" onClick={() => { setEditOpen(true); setMenuOpen(false); }} type="button">Edit</button>
                  <button className="btn" onClick={async () => { await aiForThis(); setMenuOpen(false); }} disabled={!canEdit} type="button" title="Generate epic story">AI story</button>
                  <button className="btn" onClick={() => { onRemove(t.id); setMenuOpen(false); }} type="button">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hint" style={{ marginTop: 4 }}>
          {(isStreaming || liveDesc) ? (<div>{liveDesc}</div>) : (t.desc && <div>{t.desc}</div>)}

          {/* Task notes */}
          <div style={{ marginTop: 8 }}>
            <TaskNotes task={t} onUpdate={onUpdate} disabled={!canEdit} />
          </div>

          {["MAIN", "EPIC"].includes(questTypeKey) && (
            <div
              className="hint"
              title="Milestone progress"
              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 180 }}
            >
              <progress
                className="bar"
                max={100}
                value={pct}
                style={{ width: 160, height: 6 }}
              />
              <span className="mono" style={{ whiteSpace: "nowrap" }}>{pct}%</span>
            </div>
          )}

          {milestones.length > 0 && (
            <div className="milestone-list" style={{ marginTop: 6 }}>
              {milestones.map((m, idx) => {
                const weight = Math.max(0, Number(m?.milestoneWeight) || 0);
                const fallbackId = m?.id || String(idx);
                const isChecked = !!m?.done;
                const isDisabled = isChecked || !canEdit;
                return (
                  <label key={m?.id || `milestone-${idx}`} className={`milestone-item ${isChecked ? "done" : ""}`}>
                    <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => { if (!isDisabled) onMilestoneToggle?.(t.id, fallbackId); }} />
                    <span className="milestone-title">{m?.title || `Milestone ${idx + 1}`}</span>
                    {weight > 0 && (<span className="milestone-weight mono">{weight}%</span>)}
                  </label>
                );
              })}
            </div>
          )}

          {!!lastBoost && (<span className="hint" style={{ marginLeft: 8 }}>+Boost from subtasks: <b className="mono">+{lastBoost}</b></span>)}

          {deadlineText && (
            <div className={`deadline ${deadlineText.startsWith("Overdue") ? "overdue" : ""}`}>{deadlineText}</div>
          )}
        </div>
      </div>

      <div className="xp mono">{t.xp} XP</div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn" onClick={() => setAddDlgOpen(true)} disabled={!canEdit} type="button">+ Sub</button>
      </div>

      {kidsSorted?.length > 0 && (
        <div className="subtask-list" style={{ gridColumn: "1 / -1", display: "grid", gap: 8, marginTop: 8 }}>
          {kidsSorted.map((c) => (
            <ChildItem
              key={c.id}
              c={c}
              parentBase={parentBase}
              usedPct={usedPct}
              onToggle={onToggle}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}

      {editOpen && (
        <TaskEditDialog
          open={editOpen}
          task={t}
          lists={lists}
          onUpdate={onUpdate}
          onClose={() => setEditOpen(false)}
        />
      )}

      <SubAddModal
        open={addDlgOpen}
        onClose={() => setAddDlgOpen(false)}
        perCap={perCap}
        totalCap={totalCapLeft}
        onSubmit={handleSubtaskSubmit}
      />
    </div>
  );
}
