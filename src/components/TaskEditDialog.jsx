import React, { useEffect, useMemo, useRef, useState } from "react";
import { QUEST_TYPES, QUEST_UNITS_LABEL } from "../core/constants.js";
import { computeDeadlineISO } from "../core/dates.js";
import XPAllocateModal from "./XPAllocateModal.jsx";
import { XPWizard } from "./AddTaskBar.XPWizard.jsx";
import MilestoneBuilder from "./MilestoneBuilder.jsx";
import TaskNotes from "./TaskNotes.jsx";

export default function TaskEditDialog({
  open,
  task,
  lists = [],
  onUpdate,   // (id, patch)
  onClose,
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.desc || task?.description || "");
  const initQuest = (task?.questType || "BASIC").toString().toUpperCase();
  const [questType, setQuestType] = useState(QUEST_TYPES[initQuest] ? initQuest : "BASIC");
  const [duration, setDuration] = useState(Number(task?.duration || 1) || 1);
  const [xpBase, setXpBase] = useState(Number(task?.xpBase || task?.baseXp || task?.xp || 1) || 1);
  const [allocOpen, setAllocOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [alloc, setAlloc] = useState(() => ({ ...(task?.xpAwards || {}) }));
  const [listId, setListId] = useState(task?.listId || "inbox");

  // Due/Repeat (mirror AddTaskBar shape)
  const [deadlineAmt, setDeadlineAmt] = useState(Number(task?.deadlineAmt || 1) || 1);
  const [deadlineUnit, setDeadlineUnit] = useState(task?.deadlineUnit || "h");
  const [deadlineLocked, setDeadlineLocked] = useState(!!task?.deadlineLocked);
  const [deadlineEnabled, setDeadlineEnabled] = useState(
    !!(task?.deadline || task?.absoluteDue || task?.deadlineAmt != null)
  );
  const initialDeadlineRef = useRef({
    deadline: task?.deadline ?? null,
    absoluteDue: task?.absoluteDue ?? null,
    deadlineAmt: Number(task?.deadlineAmt || 1) || 1,
    deadlineUnit: task?.deadlineUnit || "h",
  });
  const [recur, setRecur] = useState(task?.recur || "none"); // none|daily|weekly|custom
  const [recurCustom, setRecurCustom] = useState(Array.isArray(task?.recurCustom) ? task.recurCustom : []);
  const [recurWeeklyDays, setRecurWeeklyDays] = useState(Array.isArray(task?.recurWeeklyDays) ? task.recurWeeklyDays : []);
  const [customMonthCursor, setCustomMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const weeklyDays = useMemo(() => {
    const src = Array.isArray(recurWeeklyDays) ? recurWeeklyDays : [];
    return Array.from(new Set(src.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
  }, [recurWeeklyDays]);
  const customDays = useMemo(() => {
    const src = Array.isArray(recurCustom) ? recurCustom : [];
    const nums = src.map((v) => typeof v === "number" ? v : Number.isFinite(v?.day) ? v.day : NaN);
    return Array.from(new Set(nums.filter((n) => Number.isFinite(n) && n >= 1 && n <= 31))).sort((a, b) => a - b);
  }, [recurCustom]);
  const hasLegacyCustom = useMemo(() => Array.isArray(recurCustom) && recurCustom.some((rc) => rc && typeof rc === "object" && !Number.isFinite(rc)), [recurCustom]);

  useEffect(() => {
    if (open) {
      try { document.body.classList.add("modal-open"); } catch {}
    }
    return () => { try { document.body.classList.remove("modal-open"); } catch {} };
  }, [open]);
  useEffect(() => {
    if (recur === "weekly" && weeklyDays.length === 0) setRecurWeeklyDays([new Date().getDay()]);
    if (recur === "custom" && customDays.length === 0 && !hasLegacyCustom) setRecurCustom([new Date().getDate()]);
  }, [recur, weeklyDays.length, customDays.length, hasLegacyCustom, setRecurWeeklyDays, setRecurCustom]);
  useEffect(() => {
    if (!deadlineEnabled) setDeadlineLocked(false);
  }, [deadlineEnabled]);
  useEffect(() => {
    if (deadlineLocked && !deadlineEnabled) setDeadlineEnabled(true);
  }, [deadlineLocked, deadlineEnabled]);

  const monthLabel = (d) => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
    } catch {
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    }
  };
  const shiftCustomMonth = (delta) => {
    setCustomMonthCursor((cur) => {
      const base = cur ? new Date(cur) : new Date();
      const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
      d.setHours(0,0,0,0);
      return d;
    });
  };
  const toggleWeeklyDay = (day) => {
    setRecurWeeklyDays((prev) => {
      const cur = Array.isArray(prev) ? new Set(prev.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n))) : new Set();
      if (cur.has(day) && cur.size > 1) cur.delete(day);
      else cur.add(day);
      if (cur.size === 0) cur.add(day);
      return Array.from(cur).sort((a, b) => a - b);
    });
  };
  const toggleCustomDay = (day) => {
    setRecurCustom((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const nums = base.map((v) => typeof v === "number" ? v : Number.isFinite(v?.day) ? v.day : NaN).filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);
      const set = new Set(nums);
      if (set.has(day)) set.delete(day); else set.add(day);
      return Array.from(set).sort((a, b) => a - b);
    });
  };

  const unitLabel = QUEST_UNITS_LABEL[QUEST_TYPES[questType]?.unit || "h"] || "hours";
  const deadlineReadOnly = deadlineLocked;
  const deadlineFieldDisabled = deadlineReadOnly || !deadlineEnabled;

  if (!open) return null;

  function applyPatch(patch) {
    if (typeof onUpdate === "function") onUpdate(task.id, patch);
  }
  function saveAllAndClose() {
    const weeklyPayload = weeklyDays;
    const customPayload = recur === "custom"
      ? (customDays.length ? customDays : (Array.isArray(recurCustom) ? recurCustom : []))
      : [];
    const safeDeadlineAmt = Math.max(1, Number(deadlineAmt) || 1);
    const init = initialDeadlineRef.current || {};
    const deadlineChanged = safeDeadlineAmt !== init.deadlineAmt || deadlineUnit !== init.deadlineUnit;
    const computedDeadline = deadlineEnabled
      ? (deadlineChanged || !init.deadline
          ? computeDeadlineISO({
              absoluteDue: null,
              deadlineAmt: safeDeadlineAmt,
              deadlineUnit,
              now: Date.now(),
            })
          : init.deadline)
      : null;
    const deadlinePayload = deadlineEnabled
      ? {
          deadline: computedDeadline,
          absoluteDue: init.absoluteDue ?? null,
          deadlineAmt: safeDeadlineAmt,
          deadlineUnit,
          deadlineLocked: !!deadlineLocked,
        }
      : {
          deadline: null,
          absoluteDue: null,
          deadlineAmt: null,
          deadlineUnit: null,
          deadlineLocked: false,
        };
    const patch = {
      title: (title || "").trim(),
      desc,
      description: desc,
      questType,
      duration: Math.max(1, Number(duration) || 1),
      xpBase: Math.max(1, Number(xpBase) || 1),
      baseXp: Math.max(1, Number(xpBase) || 1),
      listId,
      ...deadlinePayload,
      recur,
      ...(recur === 'weekly' ? { recurWeeklyDays: weeklyPayload } : { recurWeeklyDays: undefined }),
      ...(recur === 'custom' ? { recurCustom: Array.isArray(customPayload) ? customPayload : [] } : { recurCustom: undefined }),
      xpAwards: { ...(alloc || {}) },
    };
    applyPatch(patch);
    onClose?.();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal>
      <div className="modal" onClick={(e)=>e.stopPropagation()} style={{ width: 'min(780px, 96vw)' }}>
        <div className="modal-header">
          <b>Edit task</b>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body" style={{ display:'grid', gap:12 }}>
          {/* Title/Desc */}
          <div className="sf-card" style={{ padding: 12, display:'grid', gap:8 }}>
            <label className="hint">Title</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} />
            <label className="hint">Description</label>
            <textarea rows={3} value={desc} onChange={(e)=>setDesc(e.target.value)} />
          </div>

          {/* Quest Type + Duration */}
          <div className="sf-card" style={{ padding: 12 }}>
            <div className="hint" style={{ marginBottom: 6 }}>Quest</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {["BASIC","SIDE","MAIN","EPIC"].map(q => (
                <button key={q} className={`tab ${questType===q? 'active':''}`} onClick={()=>setQuestType(q)}>{QUEST_TYPES[q]?.label || q}</button>
              ))}
            </div>
          </div>

          {/* XP Base + Wizard + Allocate */}
          <div className="sf-card" style={{ padding: 12, display:'grid', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div>
                <div className="hint">Base XP</div>
                <input type="number" min={1} value={xpBase} readOnly aria-readonly style={{ cursor: 'not-allowed' }} />
                <div className="hint" style={{ fontSize: 12 }}>Change via XP wizard</div>
              </div>
              <button className="btn" onClick={()=>setWizardOpen(true)}>XP wizard...</button>
              <button className="btn" onClick={()=>setAllocOpen(true)} disabled={!xpBase}>Allocate...</button>
            </div>
          </div>

          {/* Due + Repeat */}
          <div className="sf-card" style={{ padding:12, display:'grid', gap:8 }}>
            <div className="hint">Deadline (relative)</div>
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                type="checkbox"
                checked={deadlineEnabled}
                onChange={(e)=>setDeadlineEnabled(e.target.checked)}
                disabled={deadlineReadOnly}
              />
              <span className="hint">Enable deadline</span>
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
              <input
                type="number"
                min={1}
                value={deadlineAmt}
                onChange={e=>setDeadlineAmt(Math.max(1, Number(e.target.value)||1))}
                disabled={deadlineFieldDisabled}
              />
              <select value={deadlineUnit} onChange={e=>setDeadlineUnit(e.target.value)} disabled={deadlineFieldDisabled}>
                <option value="h">hours</option>
                <option value="d">days</option>
                <option value="w">weeks</option>
              </select>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={deadlineLocked} onChange={e=>setDeadlineLocked(e.target.checked)} disabled={deadlineLocked} />
              <span className="hint">Lock future changes to deadline</span>
            </label>
            <div style={{ display:'grid', gap:6 }}>
              <div className="hint">Repeat</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['none','daily','weekly','monthly','custom'].map(r => (
                  <button key={r} className={`tab ${recur===r?'active':''}`} onClick={()=>setRecur(r)}>{r}</button>
                ))}
              </div>
              {recur === 'weekly' && (
                <div className="repeat-card" style={{ marginTop: 4 }}>
                  <div className="hint" style={{ marginBottom: 6 }}>Pick weekly days</div>
                  <div className="weekday-row">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((lbl, idx) => {
                      const active = weeklyDays.includes(idx);
                      return (
                        <button
                          key={lbl}
                          className={`weekday-chip ${active ? 'active' : ''}`}
                          onClick={() => toggleWeeklyDay(idx)}
                          type="button"
                        >
                          {lbl.slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="hint">At least one day stays selected.</div>
                </div>
              )}
              {recur === 'custom' && (
                <div className="repeat-card" style={{ display:'grid', gap:8 }}>
                  <div className="row-sb" style={{ alignItems:'center' }}>
                    <div>
                      <div className="hint">Pick days on the month view</div>
                      {hasLegacyCustom && !customDays.length ? (
                        <div className="hint" style={{ color:'var(--muted, #6b7280)' }}>
                          Existing custom slots stay active; picking new days will replace them.
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn" onClick={()=>shiftCustomMonth(-1)}>{'<'}</button>
                      <div className="hint mono" style={{ minWidth:110, textAlign:'center' }}>{monthLabel(customMonthCursor || new Date())}</div>
                      <button className="btn" onClick={()=>shiftCustomMonth(1)}>{'>'}</button>
                    </div>
                  </div>
                  {(() => {
                    const base = customMonthCursor || new Date();
                    const year = base.getFullYear();
                    const month = base.getMonth();
                    const dim = new Date(year, month + 1, 0).getDate();
                    const offset = new Date(year, month, 1).getDay();
                    const cells = Array.from({ length: offset }, () => null).concat(Array.from({ length: dim }, (_, i) => i + 1));
                    return (
                      <div className="mini-cal">
                        {['S','M','T','W','T','F','S'].map((d) => (<div key={`hh-${d}`} className="mini-cal-head">{d}</div>))}
                        {cells.map((day, idx) => {
                          if (!day) return <div key={`pad-${idx}`} className="mini-cal-cell empty" />;
                          const active = customDays.includes(day);
                          return (
                            <button key={day} className={`mini-cal-cell ${active ? 'active' : ''}`} onClick={()=>toggleCustomDay(day)} type="button">
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="hint mono">Selected days: {customDays.length ? customDays.join(', ') : 'none'}</div>
                  <div style={{ display:'flex', justifyContent:'flex-end', gap:6 }}>
                    <button className="btn" onClick={()=>setRecurCustom([])}>Clear</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Move list & Notes */}
          <div className="sf-card" style={{ padding:12, display:'grid', gap:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="hint">Move to list</span>
              <select value={listId} onChange={(e)=>setListId(e.target.value)}>
                {lists.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
            <TaskNotes task={task} onUpdate={onUpdate} disabled={false} />
          </div>
        </div>

        <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={saveAllAndClose}>Save</button>
        </div>
      </div>

      {/* Overlays */}
      {wizardOpen && (
        <div className="modal-backdrop" style={{ alignItems:'flex-start', paddingTop:50 }} onClick={()=>setWizardOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header"><b>Choose XP</b><button className="icon-btn" onClick={()=>setWizardOpen(false)}>×</button></div>
            <div className="modal-body">
              <XPWizard
                level={1}
                buffs={{}}
                initQuestType={questType}
                initDuration={duration}
                initSliders={null}
                typeLocked={() => false}
                onCancel={()=>setWizardOpen(false)}
                onSlidersChange={()=>{}}
                onApply={({ xpBase, questType: qt, duration: dur }) => {
                  setQuestType(qt); setDuration(dur); setXpBase(xpBase); setWizardOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {allocOpen && (
        <XPAllocateModal
          xpBase={xpBase}
          initialAlloc={alloc}
          onCancel={()=>setAllocOpen(false)}
          onApply={({ alloc: a }) => { setAlloc(a || {}); setAllocOpen(false); }}
        />
      )}

      {/* Milestone builder launcher is optional; leaving button out for now; can add if needed */}
    </div>
  );
}
