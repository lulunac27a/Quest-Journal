// src/components/ChallengeSection.jsx
export default function ChallengeSection({
  title,
  hint,
  open,
  onToggle,
  picks,
  templates,
  completedIds,
  onComplete,
  xpFallback,
  emptyMessage,
  toggleClassName = "on on-blue",
  containerStyle,
  sectionClassName = "daily-challenges",
}) {
  const isOpen = open !== false;
  const entries = Array.isArray(picks) ? picks : [];
  const templatesArr = Array.isArray(templates) ? templates : [];
  const completed = Array.isArray(completedIds) ? completedIds : [];
  return (
    <section className={sectionClassName} style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>{title}</h3>
        {hint && (
          <span className="hint" style={{ marginBottom: 8 }}>
            {hint}
          </span>
        )}
        <button
          aria-label={`toggle ${title}`}
          onClick={onToggle}
          className={`tap-ctl chk-ctrl ${isOpen ? toggleClassName : ""}`}
        />
      </div>
      <div className="list challenge-list">
        {isOpen && entries.length === 0 && (
          <div className="empty">{emptyMessage}</div>
        )}
        {isOpen &&
          entries.map((pid) => {
            const tpl = templatesArr.find((t) => t.id === pid);
            if (!tpl) return null;
            const done = completed.includes(pid);
            return (
              <div key={pid} className={`task ${done ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onComplete(pid)}
                />
                <div className="title">{tpl.title}</div>
                <div className="xp mono">{tpl.xp ?? xpFallback} XP</div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
