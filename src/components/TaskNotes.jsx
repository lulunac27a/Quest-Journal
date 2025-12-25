import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TaskNotes.css";
import { uid } from "../utils/constants.js";

/**
 * TaskNotes
 * - Minimal sticky/comment UI for a task
 * - Keeps implementation self-contained; integrates via onUpdate(taskId, { notes })
 */
export default function TaskNotes({ task, onUpdate, disabled = false }) {
  const notes = Array.isArray(task?.notes) ? task.notes : [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const popRef = useRef(null);

  useEffect(() => {
    function onDown(e){
      if (!open) return;
      const el = popRef.current;
      try {
        if (el && !el.contains(e.target)) setOpen(false);
      } catch {}
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const count = notes.length;
  const hasPinned = notes.some(n => n?.pinned);
  const sorted = useMemo(() => {
    const arr = [...notes];
    // pin first, then updatedAt desc
    arr.sort((a,b) => {
      const pa = a?.pinned ? 1 : 0; const pb = b?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = Date.parse(a?.updatedAt || a?.createdAt || 0) || 0;
      const tb = Date.parse(b?.updatedAt || b?.createdAt || 0) || 0;
      return tb - ta;
    });
    return arr;
  }, [notes]);

  function saveNotes(next){
    if (typeof onUpdate === 'function') onUpdate(task?.id, { notes: next });
  }

  function addNote(){
    const v = (draft || "").trim();
    if (!v) return;
    const n = { id: uid(), text: v, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveNotes([n, ...notes]);
    setDraft("");
  }

  function beginEdit(id, text){ setEditingId(id); setEditText(text || ""); }
  function cancelEdit(){ setEditingId(null); setEditText(""); }
  function commitEdit(){
    const v = (editText || "").trim(); if (!editingId) return;
    if (!v) { // delete empty on save
      saveNotes(notes.filter(n => n.id !== editingId));
    } else {
      saveNotes(notes.map(n => n.id === editingId ? { ...n, text: v, updatedAt: new Date().toISOString() } : n));
    }
    cancelEdit();
  }
  function delNote(id){ saveNotes(notes.filter(n => n.id !== id)); }
  function togglePin(id){ saveNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n)); }

  return (
    <div className="tn-wrap">
      <button
        type="button"
        className="icon-btn sm tn-btn"
        title={count > 0 ? `Notes (${count})` : "Add note"}
        aria-haspopup
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        disabled={false}
      >
        🗒️
        {count > 0 && <span className="tn-count" aria-hidden>{count}</span>}
      </button>

      {open && (
        <div ref={popRef} className="tn-pop" role="dialog" aria-label="Task notes">
          <div className="tn-header">
            <b>Notes</b>
            <span className="tn-chip">{hasPinned ? "📌 pinned" : ""}</span>
          </div>

          {!disabled && (
            <div className="tn-input">
              <textarea
                placeholder="Write a quick note..."
                value={draft}
                onChange={(e)=>setDraft(e.target.value)}
                onKeyDown={(e)=>{
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote();
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
              <div className="tn-actions">
                <button className="btn" type="button" onClick={()=>{ setDraft(""); setOpen(false); }}>Close</button>
                <button className="btn primary" type="button" onClick={addNote} disabled={!draft.trim()}>Add</button>
              </div>
            </div>
          )}

          <div className="tn-list">
            {sorted.length === 0 && <div className="tn-empty">No notes yet.</div>}
            {sorted.map(n => (
              <div key={n.id} className="tn-note">
                <div className="tn-note-head">
                  <span className="tn-chip">
                    {n.pinned ? <span className="tn-pin">📌</span> : null}
                    {" "}
                    {new Date(n.updatedAt || n.createdAt || Date.now()).toLocaleString()}
                  </span>
                  <span>
                    <button className="icon-btn sm" title={n.pinned ? "Unpin" : "Pin"} onClick={()=>togglePin(n.id)} aria-label="pin">{n.pinned ? '📍' : '📌'}</button>
                    <button className="icon-btn sm" title="Edit" onClick={()=>beginEdit(n.id, n.text)} aria-label="edit">✏️</button>
                    <button className="icon-btn sm" title="Delete" onClick={()=>delNote(n.id)} aria-label="delete">🗑️</button>
                  </span>
                </div>
                {editingId === n.id ? (
                  <div className="tn-note-edit" style={{ marginTop: 6 }}>
                    <textarea value={editText} onChange={(e)=>setEditText(e.target.value)} onKeyDown={(e)=>{ if ((e.ctrlKey||e.metaKey)&&e.key==='Enter') commitEdit(); if (e.key==='Escape') cancelEdit(); }} />
                    <div className="tn-actions">
                      <button className="btn" onClick={cancelEdit} type="button">Cancel</button>
                      <button className="btn primary" onClick={commitEdit} type="button" disabled={!editText.trim()}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="tn-note-body">{n.text}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

