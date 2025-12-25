import React, { useMemo, useRef, useState, useEffect } from "react";
import { SubAddModal } from "./TaskRow.SubAddModal.jsx";

export default function ChildItem({ c, parentBase = 1, usedPct = 0, onToggle, onRemove, onUpdate }) {
  const childCanEdit = !c.done;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(c.title || "");
  const [xpOpen, setXpOpen] = useState(false);
  const menuRef = useRef(null);
  const menuBtnStyle = { width: "100%", textAlign: "left", justifyContent: "flex-start", padding: "6px 10px", fontSize: 12.5, borderRadius: 8, lineHeight: 1.2 };

  const base = useMemo(() => Math.max(1, parseInt(parentBase, 10) || 1), [parentBase]);
  const currentPct = useMemo(() => Math.max(1, Math.round((Math.max(1, parseInt(c?.xp || 1, 10)) / base) * 100)), [c?.xp, base]);
  const capForChild = useMemo(() => Math.max(1, Math.min(99, 200 - Math.max(0, usedPct - currentPct))), [usedPct, currentPct]);

  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => { setNameDraft(c.title || ""); }, [c.title]);

  const startEditName = () => { setEditingName(true); setMenuOpen(false); };
  const saveName = () => {
    const v = (nameDraft || "").trim();
    if (!v || v === c.title) { setEditingName(false); return; }
    onUpdate?.(c.id, { title: v });
    setEditingName(false);
  };

  const openEditXp = () => { setXpOpen(true); setMenuOpen(false); };

  const confirmDelete = () => {
    setMenuOpen(false);
    if (!confirm("Delete this subtask?")) return;
    onRemove(c.id);
  };

  return (
    <div className={`task ${c.done ? "done" : ""}`} style={{ marginLeft: 16 }}>
      <input
        type="checkbox"
        checked={c.done}
        onChange={() => onToggle(c.id)}
        aria-label="Toggle subtask done"
        data-xp-anchor={c.id}
      />
      <div className="title" style={{ minWidth: 140 }}>
        {editingName ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="text-input"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              aria-label="Edit subtask title"
            />
            <button className="btn primary" onClick={saveName} type="button">Save</button>
            <button className="btn" onClick={() => { setEditingName(false); setNameDraft(c.title || ""); }} type="button">Cancel</button>
          </div>
        ) : (
          <>
            <div>{c.title}</div>
            {c.desc && (<div className="hint" style={{ marginTop: 4 }}>{c.desc}</div>)}
          </>
        )}
      </div>
      <div className="xp mono">{c.xp} XP</div>
      <div className="menuWrap" style={{ position: "relative" }} ref={menuRef}>
        <button
          className="icon-btn more"
          aria-label="More actions"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          type="button"
        >
          ...
        </button>
        {menuOpen && (
          <div
            className="task-menu"
            role="menu"
            style={{ position: "absolute", top: "110%", right: 0, zIndex: 40, minWidth: 168, padding: 6, display: "grid", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
          >
            <button className="btn" role="menuitem" onClick={startEditName} disabled={!childCanEdit} style={menuBtnStyle}>Edit name</button>
            <button className="btn" role="menuitem" onClick={openEditXp} disabled={!childCanEdit} style={menuBtnStyle}>Edit XP</button>
            <button className="btn danger" role="menuitem" onClick={confirmDelete} style={menuBtnStyle}>Delete</button>
          </div>
        )}
      </div>

      <SubAddModal
        open={xpOpen}
        onClose={() => setXpOpen(false)}
        perCap={capForChild}
        totalCap={capForChild}
        defaultTitle={c.title}
        titleEnabled={true}
        titleReadOnly
        heading="Adjust subtask XP"
        submitLabel="Apply"
        initialPercent={currentPct}
        onSubmit={({ percent, forceOne }) => {
          if (forceOne) { onUpdate?.(c.id, { xp: 1 }); setXpOpen(false); return; }
          const p = Math.max(1, Math.min(capForChild, percent));
          const nextXp = Math.max(1, Math.round((p / 100) * base));
          onUpdate?.(c.id, { xp: nextXp });
          setXpOpen(false);
        }}
      />
    </div>
  );
}
