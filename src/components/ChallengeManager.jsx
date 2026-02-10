import { useState } from "react";

export default function ChallengeManager({ label, templates, onAdd, onRemove, defaultXP = 250 }) {
  const [title, setTitle] = useState("");
  const [xp, setXp] = useState("");

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const n = xp === "" ? undefined : Math.max(0, Math.min(1000, Math.floor(Number(xp) || 0)));
    onAdd(t, n);
    setTitle("");
    setXp("");
  };

  return (
    <div className="cm" style={{
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 12,
      background: "var(--card)",
      color: "var(--text)",
      maxWidth: "100%",
      overflowX: "hidden"
    }}>
      <div className="cm-head" style={{ marginBottom: 8, fontWeight: 600, maxWidth: "100%" }}>
        Manage {label} Templates{" "}
        <span style={{ color: "#64748b", fontWeight: 400 }}>(default XP: {defaultXP})</span>
      </div>

      {/* ردیف ورودی‌ها – ریسپانسیو و قابل شکستن در موبایل */}
      <div className="cm-controls" style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          className="text-input cm-title"
          placeholder={`Write a ${label.toLowerCase()} challenge...`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            minHeight: "var(--input-min-h, 38px)",
            background: "var(--card)",
            color: "var(--text)",
            maxWidth: "100%"
          }}
        />
        <input
          className="text-input cm-xp"
          placeholder="XP (optional)"
          value={xp}
          onChange={(e) => setXp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{
            flex: "0 0 120px",
            width: "120px",
            maxWidth: "35vw",
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            minHeight: "var(--input-min-h, 38px)",
            background: "var(--card)",
            color: "var(--text)"
          }}
          inputMode="numeric"
        />
        <button className="btn primary cm-add" onClick={add} style={{ flex: "0 0 auto" }}>Add</button>
      </div>

      {/* لیست – بدون اسکرول افقی، عنوان‌ها ellipsis و ردیف‌ها جمع‌وجور */}
      <div
        className="challenge-list cm-list"
        style={{
          display: "grid",
          gap: 8,
          maxHeight: 220,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          maxWidth: "100%"
        }}
      >
        {templates.length === 0 && <div className="empty" style={{ margin: 0 }}>Nothing yet.</div>}

        {templates.map((t) => (
          <div
            key={t.id}
            className="task cm-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              alignItems: "center",
              gap: 8,
              maxWidth: "100%"
            }}
          >
            <div className="title cm-titlecell" style={{
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }}>
              {t.title}
            </div>

            <div className="xp mono cm-xpcell" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
              {t.xp ?? defaultXP} XP
            </div>

            <button
              className="icon icon-btn cm-del"
              title="Delete"
              onClick={() => onRemove(t.id)}
              aria-label={`Delete ${t.title}`}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {/* استایل‌های کمکیِ ریسپانسیو */}
      <style>{`
        /* شکستن بهتر روی موبایل */
        @media (max-width: 520px){
          .cm .cm-controls { gap: 6px; }
          .cm .cm-xp { width: 100px; flex-basis: 100px; max-width: 32vw; }
          .cm .cm-add { padding: 0 10px; }
          .cm .cm-row { grid-template-columns: 1fr auto auto; }
        }

        /* فوق‌العاده باریک: ستون XP و دکمه‌ی حذف در یک خط باریک می‌مانند؛ عنوان همیشه ellipsis می‌شود */
        @media (max-width: 380px){
          .cm .cm-xp { width: 84px; flex-basis: 84px; max-width: 28vw; }
        }
      `}</style>
    </div>
  );
}
