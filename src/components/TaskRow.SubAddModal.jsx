import React, { useEffect, useRef, useState } from "react";

export function SubAddModal({
  open,
  onClose,
  onSubmit,
  perCap = 99,
  totalCap = 200,
  defaultTitle = "",
  titleEnabled = true,
  heading = "Add subtask",
  submitLabel,
  initialPercent,
  titleReadOnly = false,
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [pct, setPct] = useState(Math.min(initialPercent ?? 10, Math.max(1, perCap)));
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle || "");
      setPct(Math.min(initialPercent ?? 10, Math.max(1, perCap)));
      if (titleEnabled) setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, perCap, defaultTitle, initialPercent, titleEnabled]);

  if (!open) return null;

  const capReached = perCap <= 0 || totalCap <= 0;

  const submit = () => {
    const t = (title || defaultTitle || "").trim();
    if (titleEnabled && !t) return;
    if (capReached) {
      onSubmit?.({ title: t, percent: 1, forceOne: true });
      return;
    }
    const p = Math.max(1, Math.min(99, parseInt(pct, 10) || 1, perCap));
    onSubmit?.({ title: t, percent: p, forceOne: false });
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add subtask"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <b>{heading}</b>
          <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close">×</button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {titleEnabled && (
            <>
              <label className="hint" htmlFor="st-title">
                Subtask title
              </label>
              <input
                id="st-title"
                ref={inputRef}
                type="text"
                value={title}
                readOnly={titleReadOnly}
                disabled={titleReadOnly}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") onClose();
                }}
              />
            </>
          )}

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, alignItems: "center" }}
          >
            <input
              id="st-pct-range"
              type="range"
              min={1}
              max={Math.max(1, perCap)}
              step={1}
              value={capReached ? 1 : Math.min(pct, perCap)}
              onChange={(e) => setPct(parseInt(e.target.value, 10))}
              disabled={capReached}
            />
            <input
              id="st-pct"
              type="number"
              min={1}
              max={Math.max(1, perCap)}
              step={1}
              value={capReached ? 1 : Math.min(pct, perCap)}
              onChange={(e) => setPct(parseInt(e.target.value || "0", 10))}
              disabled={capReached}
            />
          </div>

          <label className="hint" htmlFor="st-pct">
            {capReached ? (
              <>
                Total cap reached — new subtasks will have <b>1 XP</b>.
              </>
            ) : (
              <>
                Percent of parent XP {" "}
                <span className="mono">(1–{Math.max(0, perCap)}%, total ≤ {totalCap}%)</span>
              </>
            )}
          </label>

          {capReached && (
            <div className="hint" style={{ color: "var(--text-muted,#888)" }}>
              You’ve reached the 200% total cap. New subtasks will be added with <b>1 XP</b>.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" type="button" onClick={submit} disabled={titleEnabled && !title.trim()}>
              {submitLabel || (capReached ? "Add (1 XP)" : "Add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
