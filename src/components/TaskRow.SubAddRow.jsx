import React from "react";

export default function SubAddRow({ addRowRef, newSubTitle, setNewSubTitle, onSubmit, onCancel }) {
  return (
    <div ref={addRowRef} className="subtask-add" style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input
        className="text-input"
        autoFocus
        placeholder="Subtask title..."
        value={newSubTitle}
        onChange={(e) => setNewSubTitle(e.target.value)}
        onFocus={(e) => { try { e.target.scrollIntoView({ block: "nearest" }); } catch {} }}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        aria-label="Subtask title"
      />
      <button className="btn" onClick={onSubmit} type="button">Add</button>
      <button className="btn" onClick={onCancel} type="button">Cancel</button>
    </div>
  );
}

