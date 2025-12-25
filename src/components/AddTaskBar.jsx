// src/components/AddTaskBar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import { storyForTask } from "../utils/ai.js";

import { XP_TYPES, XP_META, loadMultiXP, computeBuffBreakdown } from "../core/multixp.js";

import { suggestXP, bandFor, stepFor } from "../core/xpSuggest.js";

import { QUEST_TYPES, QUEST_UNITS_LABEL } from "../core/constants.js";

import MilestoneBuilder from "./MilestoneBuilder.jsx";

import { XPWizard as XPWizardExt } from "./AddTaskBar.XPWizard.jsx";

import "./AddTaskBar.css";

/* ---------- helpers ---------- */
function sumMapValues(obj) {  return Object.values(obj || {}).reduce((acc, v) => {    
const n = parseInt(v, 10);
    return acc + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}
function clampAllocation(nextMap, key, base) {  
const total = sumMapValues(nextMap);
  if (total <= base) return nextMap;
  
const cur = parseInt(nextMap[key] || 0, 10) || 0;
  
const over = total - base;
  
const newVal = Math.max(0, cur - over);
  return { ...nextMap, [key]: newVal ? String(newVal) : "" };
}
function primaryBranchOf(allocMap) {  
const total = sumMapValues(allocMap);
  if (total <= 0) return null;
  
let best = null, bestVal = 0;
  for (
const k of XP_TYPES) {    
const v = parseInt(allocMap?.[k] || 0, 10) || 0;
    if (v > bestVal) { bestVal = v;
 best = k;
 }  }  return bestVal / total >= 0.5 ? best : null;
}
/* ---------- component ---------- */
export default 
function AddTaskBar({  text, setText,  aiText, setAiText,  xpInput, setXpInput,  deadlineAmt, setDeadlineAmt,  deadlineUnit, setDeadlineUnit,  setAbsoluteDue,  recur, setRecur,  recurCustom, setRecurCustom,  recurWeeklyDays = [], setRecurWeeklyDays,  desc, setDesc,  onAdd,  level = 1,  aiMode = "epic",}) {  
const titleRef = useRef(null);
  
const wrapRef = useRef(null);
  
const [questType, setQuestType] = useState("BASIC");
  
const [duration, setDuration] = useState(1);
  
const [showDue, setShowDue] = useState(false);
  
const [showRepeat, setShowRepeat] = useState(false);
  // Prevent later edits to deadline for this task  
const [lockDeadline, setLockDeadline] = useState(false);
  
const [xpWizardOpen, setXpWizardOpen] = useState(false);
  
const [allocOpen, setAllocOpen] = useState(false);
  
const [alloc, setAlloc] = useState({});
  
const [xpSliders, setXpSliders] = useState(null);
  
const [toolsOpen, setToolsOpen] = useState(false);
  
const [showMB, setShowMB] = useState(false);
  
const [pendingSubtasks, setPendingSubtasks] = useState(null);
  
const [buffs, setBuffs] = useState(() => computeBuffBreakdown(loadMultiXP()));
  
const [customMonthCursor, setCustomMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  useEffect(() => {    
const id = setInterval(() => setBuffs(computeBuffBreakdown(loadMultiXP())), 1500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {    
function onDoc(e) {      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) { setShowDue(false);
 setShowRepeat(false);
 setToolsOpen(false);
 }    }    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {    
const todayDow = new Date().getDay();
    if (recur === "weekly" && typeof setRecurWeeklyDays === "function" && (!Array.isArray(recurWeeklyDays) || recurWeeklyDays.length === 0)) { setRecurWeeklyDays([todayDow]);
 }
    if (recur === "custom" && typeof setRecurCustom === "function" && (!Array.isArray(recurCustom) || recurCustom.length === 0)) {      
const todayDate = new Date().getDate();
      setRecurCustom([todayDate]);
    }
  }, [recur, recurCustom, recurWeeklyDays, setRecurCustom, setRecurWeeklyDays]);
  
const safeBase = !xpInput ? 1 : Math.max(1, parseInt(xpInput, 10) || 1);
  
const totalAlloc = sumMapValues(alloc);
  
const remaining = Math.max(0, safeBase - totalAlloc);
  
const branchPreview = useMemo(() => {    
const out = {};
    XP_TYPES.forEach((t) => {      
const raw = parseInt(alloc[t], 10) || 0;
      
const mBranch = (buffs?.branchMul?.[t] || 1);
      
const final = raw > 0 ? Math.round(raw * mBranch) : 0;
      out[t] = { raw, final, delta: final - raw, mult: mBranch };
    });
    return out;
  }, [alloc, buffs]);
  
const totalsPreview = useMemo(() => {    
const raw = XP_TYPES.reduce((s, t) => s + (branchPreview[t].raw || 0), 0);
    
const deltaBranch = XP_TYPES.reduce((s, t) => s + (branchPreview[t].delta || 0), 0);
    return { raw, deltaBranch, finalNoGlobal: raw + deltaBranch };
  }, [branchPreview]);
  
const gMul = buffs?.globalMul || 1;
  
const gDelta = xpInput ? Math.max(0, Math.round(xpInput * (gMul - 1))) : 0;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const weeklyDays = useMemo(() => {    
const src = Array.isArray(recurWeeklyDays) ? recurWeeklyDays : [];
    const uniq = Array.from(new Set(src.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)));
    return uniq.sort((a, b) => a - b);
  }, [recurWeeklyDays]);
  
const customDays = useMemo(() => {    
const src = Array.isArray(recurCustom) ? recurCustom : [];
    const nums = src.map((v) => typeof v === "number" ? v : Number.isFinite(v?.day) ? v.day : NaN);
    const uniq = Array.from(new Set(nums.filter((n) => Number.isFinite(n) && n >= 1 && n <= 31)));
    return uniq.sort((a, b) => a - b);
  }, [recurCustom]);
  
const hasLegacyCustom = useMemo(() => Array.isArray(recurCustom) && recurCustom.some((rc) => rc && typeof rc === "object" && !Number.isFinite(rc)), [recurCustom]);

function toggleWeeklyDay(day) {    
if (!setRecurWeeklyDays) return;
    setRecurWeeklyDays((prev) => {      
const current = Array.isArray(prev) ? new Set(prev.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n))) : new Set();
      if (current.has(day) && current.size > 1) current.delete(day);
      else current.add(day);
      if (current.size === 0) current.add(day);
      return Array.from(current).sort((a, b) => a - b);
    });
  }  
function toggleCustomDay(day) {    
if (!setRecurCustom) return;
    setRecurCustom((prev) => {      
const current = Array.isArray(prev) ? prev.slice() : [];
      const base = current.map((v) => typeof v === "number" ? v : Number.isFinite(v?.day) ? v.day : NaN).filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);
      const next = new Set(base);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      const out = Array.from(next).sort((a, b) => a - b);
      return out;
    });
  }
  
function shiftCustomMonth(delta) {    
setCustomMonthCursor((cur) => {      
const base = cur ? new Date(cur) : new Date();
      const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }
  
function monthLabel(d) {    
try {      
return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
    } catch {      
return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    }
  }
  
const currentPrimary = primaryBranchOf(alloc);
  async function handleAI() {
    const title = (text || "").trim();
    if (!title) { titleRef.current?.focus(); return; }
    try {
      let final = "";
      await storyForTask(aiMode, title, desc, {
        stream: true,
        onToken: (_tok, full) => {
          final = full;
          setDesc(full);
          setAiText?.(full);
        },
      });
    } catch (e) {
      alert("AI failed: " + e.message);
    }
  }
  function updateAlloc(t, raw) {
const base = !xpInput ? 1 : Math.max(1, parseInt(xpInput, 10) || 1);
    
let val = raw === "" ? "" : String(Math.max(0, parseInt(raw, 10) || 0));
    
const next = { ...alloc, [t]: val };
    
const clamped = clampAllocation(next, t, base);
    setAlloc(clamped);
  }  
function clearAllocAll() { setAlloc({});
 }  
function fillEven() {    
const base = !xpInput ? 1 : Math.max(1, parseInt(xpInput, 10) || 1);
    
const per = Math.max(0, Math.floor(base / XP_TYPES.length));
    
const rest = Math.max(0, base - per * XP_TYPES.length);
    
const next = Object.fromEntries(XP_TYPES.map((t, i) => [t, String(per + (i < rest ? 1 : 0))]));
    setAlloc(next);
  }  
function typeLocked(q) {    
const t = QUEST_TYPES[q];
    return (level || 1) < (t?.unlockLvl || 1);
  }  
function handleAdd() {    
const title = (text || aiText || "").trim();
    if (!title) { titleRef.current?.focus();
 return;
 }    
const xpAwards = {};
    for (
const t of XP_TYPES) {      
const v = parseInt(alloc[t] || 0, 10);
      if (Number.isFinite(v) && v > 0) xpAwards[t] = v;
    }    
const primary = primaryBranchOf(xpAwards) || undefined;
    
const qmeta = QUEST_TYPES[questType] || QUEST_TYPES.BASIC;
    
const weeklyPayload = weeklyDays;
    
const customPayload = recur === "custom"
      ? (customDays.length ? customDays : (Array.isArray(recurCustom) ? recurCustom : []).filter(Boolean))
      : [];
    
const task = {      title,      description: desc || "",      baseXp: Math.max(1, parseInt(xpInput || 1, 10)),      xpBase: Math.max(1, parseInt(xpInput || 1, 10)),      xpAwards,      primaryBranch: primary,      questType,      duration: Math.max(1, Number(duration) || 1),      createdAt: new Date().toISOString(),      done: false,      escrow: { mode: qmeta.escrow, paid: false },      deadlineAmt,      deadlineUnit,      recur,      ...(recur === 'weekly' && weeklyPayload.length ? { recurWeeklyDays: weeklyPayload } : {}),      ...(recur === 'custom' ? { recurCustom: Array.isArray(customPayload) ? customPayload : [] } : {}),      deadlineLocked: !!lockDeadline,      ...(pendingSubtasks ? { subtasks: pendingSubtasks.map(s => ({ ...s })) } : {}),    };
    onAdd?.(task);
    setAlloc({});
    setXpInput(undefined);
    setDuration(1);
    setQuestType("BASIC");
    setXpSliders(null);
    setPendingSubtasks(null);
    setShowMB(false);
    setLockDeadline(false);
    if (recur === 'custom') setRecurCustom([]);
    if (setRecurWeeklyDays) setRecurWeeklyDays([new Date().getDay()]);
  }  // dark-mode input text tweak  
const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  
const fieldStyle = isDark    ? { backgroundColor: "#10254fff", color: "#98a5c5ff", transition: "background-color 0.3s ease, color 0.3s ease" }    : {};
  return (    <section className="add addTaskBar add-task-bar" ref={wrapRef}>      {
/* main row items as direct children (no extra wrappers) */}      <input        ref={titleRef}        type="text"        className="titleInput"        placeholder="Task title..."        value={text}        onChange={(e) => setText(e.target.value)}        style={fieldStyle}      />      <div className="xpGroup" style={{ display: "flex", alignItems: "center", gap: 6 }}>        <span className="xpLabel">XP</span>        <input          className="xpInput"          type="number"          value={xpInput ?? ""}          placeholder="-"          readOnly          title="Select XP via the wizard"          style={fieldStyle}        />        {xpInput ? (          <small className="hint mono" title={`global buff x${gMul.toFixed(2)}`}>+{Math.max(0, Math.round(xpInput * (gMul - 1)))}</small>        ) : null}        <button className="btn" onClick={() => setXpWizardOpen(true)} title="Choose XP">XP...</button>        <button className="btn" onClick={() => setAllocOpen(true)} title="Allocate branches" disabled={!xpInput}>          Allocate...        </button>      </div>      {
/* Due */}      <div className="dueWrap" style={{ position: "relative" }}>        <button className="btn" onClick={() => { setShowDue(v => !v);
 setShowRepeat(false);
 }}>Due v</button>        {showDue && (          <div            style={{              position: "absolute",              top: "110%",              right: 0,              zIndex: 30,              background: "var(--card)",              border: "1px solid var(--border)",              borderRadius: 12,              padding: 10,              boxShadow: "0 10px 26px rgba(0,0,0,.12)",              width: "min(92vw, 320px)",              display: "grid",              gap: 8,            }}          >            <b>Set deadline</b>            <div className="hint">Relative:</div>            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>              <input                className="dueInput"                type="number"                min={1}                value={deadlineAmt}                onChange={(e) => {                  
const n = parseInt(e.target.value || 1, 10);
                  setDeadlineAmt(Number.isFinite(n) && n > 0 ? n : 1);
                }}                placeholder="2"                style={fieldStyle}              />              <select value={deadlineUnit} onChange={(e) => setDeadlineUnit(e.target.value)} className="dueSelect" style={fieldStyle}>                <option value="min">min</option>                <option value="h">h</option>                <option value="d">d</option>              </select>            </div>            <div className="hint">Absolute:</div>            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>              <input                type="date"                onChange={(e) => {                  
const d = e.target.value;
                  if (!d) return setAbsoluteDue?.(null);
                  
const iso = new Date(`${d}T23:59:59`).toISOString();
                  setAbsoluteDue?.(iso);
                }}                style={fieldStyle}              />              <input                type="time"                onChange={(e) => {                  
const t = e.target.value;
                  if (!t) return;
                  
const d = new Date();
                  
const [H, M] = t.split(":").map((x) => parseInt(x || "0", 10));
                  d.setHours(H);
 d.setMinutes(M);
 d.setSeconds(0);
 d.setMilliseconds(0);
                  setAbsoluteDue?.(d.toISOString());
                }}                style={fieldStyle}              />            </div>            <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>              <input type="checkbox" checked={lockDeadline} onChange={(e) => setLockDeadline(e.target.checked)} />              <span>Don't 
let me change the deadline</span>            </label>            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>              <button className="btn" onClick={() => setShowDue(false)}>Close</button>            </div>          </div>        )}      </div>      {
/* Repeat */}      <div className="repeatWrap" style={{ position: "relative" }}>        <button className="btn" onClick={() => { setShowRepeat(v => !v);
 setShowDue(false);
 }}>Repeat</button>        {showRepeat && (          <div            style={{              position: "absolute",              top: "110%",              right: 0,              zIndex: 30,              background: "var(--card)",              border: "1px solid var(--border)",              borderRadius: 12,              padding: 10,              boxShadow: "0 10px 26px rgba(0,0,0,.12)",              width: "min(92vw, 320px)",              display: "grid",              gap: 10,            }}          >            <b>Repeat</b>            <select value={recur} onChange={(e) => setRecur(e.target.value)} style={fieldStyle}>              <option value="none">No repeat</option>              <option value="daily">Repeat: daily</option>              <option value="weekly">Repeat: weekly</option>              <option value="monthly">Repeat: monthly</option>              <option value="custom">Repeat: custom</option>            </select>            {recur === 'weekly' && (              <div className="repeat-card">                <div className="hint" style={{ marginBottom: 6 }}>Pick the days each week</div>                <div className="weekday-row">                  {WEEKDAY_LABELS.map((lbl, idx) => {                    
const active = weeklyDays.includes(idx);
                    return (                      <button                        key={lbl}                        className={`weekday-chip ${active ? 'active' : ''}`}                        onClick={() => toggleWeeklyDay(idx)}                        type="button"                        title={lbl}                      >                        {lbl.slice(0, 2)}                      </button>                    );
                  })}                </div>                <div className="hint">At least one day stays selected.</div>              </div>            )}            {recur === 'custom' && (              <div className="repeat-card" style={{ display: 'grid', gap: 8 }}>                <div className="row-sb" style={{ alignItems: 'center' }}>                  <div>                    <div className="hint">Pick days on the calendar</div>                    {hasLegacyCustom && !customDays.length ? (                      <div className="hint" style={{ color: 'var(--muted, #6b7280)' }}>Existing custom slots stay active; picking new days will replace them.</div>                    ) : null}                  </div>                  <div style={{ display: 'flex', gap: 6 }}>                    <button className="btn" onClick={() => shiftCustomMonth(-1)} title="Prev month">{'<'}</button>                    <div className="hint mono" style={{ minWidth: 110, textAlign: 'center' }}>{monthLabel(customMonthCursor || new Date())}</div>                    <button className="btn" onClick={() => shiftCustomMonth(1)} title="Next month">{'>'}</button>                  </div>                </div>                {(() => {                  
const base = customMonthCursor || new Date();
                  const year = base.getFullYear();
                  const month = base.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const offset = new Date(year, month, 1).getDay();
                  const cells = Array.from({ length: offset }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
                  return (                    <div className="mini-cal">                      {["S","M","T","W","T","F","S"].map((d) => (                        <div key={`h-${d}`} className="mini-cal-head">{d}</div>                      ))}                      {cells.map((day, idx) => {                        
if (!day) return <div key={`pad-${idx}`} className="mini-cal-cell empty" />;
                        const active = customDays.includes(day);
                        return (                          <button                            key={day}                            type="button"                            className={`mini-cal-cell ${active ? 'active' : ''}`}                            onClick={() => toggleCustomDay(day)}                          >                            {day}                          </button>                        );
                      })}                    </div>                  );
                })()}                <div className="hint mono">Selected days: {customDays.length ? customDays.join(", ") : "none"}</div>                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>                  <button className="btn" onClick={() => setRecurCustom([])}>Clear</button>                </div>              </div>            )}            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>              <button className="btn" onClick={() => setShowRepeat(false)}>Close</button>            </div>          </div>        )}      </div>      <button className="btn aiBtn" onClick={handleAI} title="AI story">✨</button>      <div className="toolsWrap" style={{ position:"relative" }}>        <button className="btn" aria-haspopup="menu" aria-expanded={toolsOpen} onClick={() => setToolsOpen(o=>!o)} title="More options">...</button>        {toolsOpen && (          <div role="menu" style={{ position:"absolute", right:0, top:"110%", background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, boxShadow:"0 10px 26px rgba(0,0,0,.12)", padding:6, display:"grid", gap:6, zIndex:20, minWidth:160 }}>            <button className="btn" role="menuitem" onClick={() => { setToolsOpen(false);
 setAllocOpen(true);
 }} disabled={!xpInput}>Allocate...</button>            <button className="btn" role="menuitem" onClick={() => { setToolsOpen(false);
 setShowDue(true);
 setShowRepeat(false);
 }}>Due</button>            <button className="btn" role="menuitem" onClick={() => { setToolsOpen(false);
 setShowRepeat(true);
 setShowDue(false);
 }}>Repeat</button>          </div>        )}      </div>      <button className="btn addBtn primary" onClick={handleAdd} title="Add this task">+ Add</button>      {
/* Description / Notes */}      <div className="notesWrap" style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>        <span className="xpLabel">Description / Notes</span>        <textarea          rows={3}          placeholder="Write notes... or click AI story"          value={desc}          onChange={(e) => setDesc(e.target.value)}          style={fieldStyle}        />      </div>      {
/* XP WIZARD */}      {xpWizardOpen && (        <div className="modal-backdrop" style={{ alignItems: "flex-start", paddingTop: 50 }} onClick={() => setXpWizardOpen(false)}>          <div className="modal" onClick={(e) => e.stopPropagation()}>            <div className="modal-header">              <b>Choose XP</b>              <button className="icon-btn" onClick={() => setXpWizardOpen(false)} aria-label="Close" title="Close">×</button>            </div>            <XPWizardExt              level={level}              buffs={buffs}              initQuestType={questType}              initDuration={duration}              initSliders={xpSliders}              typeLocked={typeLocked}              onCancel={() => setXpWizardOpen(false)}              onSlidersChange={(s) => setXpSliders(s)}              onApply={({ xpBase, questType: qt, duration: dur, openMilestones }) => {                setQuestType(qt);
                setDuration(dur);
                setXpInput(xpBase);
                setXpWizardOpen(false);
                if (openMilestones) setShowMB(true);
                else setAllocOpen(true);
              }}            />          </div>        </div>      )}      {
/* Milestone Builder */}      {showMB && (        <div className="modal-backdrop" onClick={() => setShowMB(false)}>          <MilestoneBuilder            defaultCount={questType === "EPIC" ? 4 : 3}            onCancel={() => setShowMB(false)}            onCreateSubtasks={(subs) => setPendingSubtasks(subs)}            onCreate={() => { setShowMB(false);
 setAllocOpen(true);
 }}          />        </div>      )}      {
/* Allocation Modal */}      {allocOpen && (        <div className="modal-backdrop" onClick={() => setAllocOpen(false)}>          <div className="modal" onClick={(e) => e.stopPropagation()}>            <div className="modal-header" style={{ alignItems: "flex-start" }}>              <div>                <b>Allocate XP branches</b>                {currentPrimary && (                  <div className="hint" style={{ marginTop: 4 }}>                    <span                      className="chip"                      style={{                        borderColor: XP_META[currentPrimary]?.color,                        color: XP_META[currentPrimary]?.color,                      }}                    >                      {currentPrimary} task                    </span>                  </div>                )}              </div>              <div style={{ display: "flex", gap: 8 }}>                <button className="btn" onClick={clearAllocAll}>Clear</button>                <button className="btn" onClick={fillEven}>Even split</button>                <button className="btn primary" onClick={() => setAllocOpen(false)}>Done</button>              </div>            </div>            <div className="row-sb" style={{ marginBottom: 6 }}>              <span className="hint">Base XP to split</span>              <span className="mono">                {safeBase}{" "}                {gDelta > 0 ? (                  <small className="hint mono" title={`global buff x${gMul.toFixed(2)}`}> (+{gDelta})</small>                ) : null}              </span>            </div>            <div className="row-sb" style={{ marginBottom: 12 }}>              <span className="hint">Allocated</span>              <span className="mono">{totalAlloc} / {safeBase} (remaining: {remaining})</span>            </div>            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:8 }}>              {XP_TYPES.map((t) => {                
const color = XP_META[t]?.color || "#4b5563";
                
const icon  = XP_META[t]?.icon  || "*";
                
const val   = alloc[t] ?? "";
                
const view  = branchPreview[t];
                return (                  <div key={t} className="xp-pill" style={{ padding: 8 }}>                    <span className="xp-ico" style={{ background: color }}>{icon}</span>                    <div className="xp-info">                      <div className="xp-name">{t}</div>                      <div className="xp-meta" style={{ justifyContent:"space-between", alignItems:"center" }}>                        <span className="hint">                          Allocated{" "}                          {view.delta > 0 ? (                            <span className="chip mono" title={`branch buff x${view.mult.toFixed(2)}`}>+{view.delta}</span>                          ) : null}                        </span>                        <input                          className="xp-chip-input"                          type="number"                          min={0}                          inputMode="numeric"                          placeholder="0"                          value={val}                          onChange={(e) => updateAlloc(t, e.target.value)}                          onKeyDown={(e) => {                            if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                          }}                          style={{ width: 80, ...fieldStyle }}                        />                      </div>                      {view.final > 0 ? (                        <div className="hint mono" style={{ marginTop: 4 }}>                          {"->"} {view.raw} <span style={{ opacity: 0.7 }}>+{view.delta}</span> = <b>{view.final}</b>                        </div>                      ) : null}                    </div>                  </div>                );
              })}            </div>            <div className="hint mono" style={{ marginTop: 8, textAlign: "right" }}>              Allocated sum: {totalsPreview.raw}              {totalsPreview.deltaBranch > 0 ? (                <> {"-"} branch buff: +{totalsPreview.deltaBranch} {"->"} {totalsPreview.finalNoGlobal}</>              ) : null}            </div>            <div className="hint" style={{ marginTop: 8 }}>              Global buff applies to total XP once (shown as + near the base), while branch buffs apply to each allocation. Unallocated amount remains as global XP only.            </div>          </div>        </div>      )}    </section>  );
}export { XPWizard } from "./AddTaskBar.XPWizard.jsx";

























