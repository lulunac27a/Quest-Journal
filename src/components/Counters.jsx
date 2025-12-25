// src/components/Counters.jsx
export default function Counters({ rootsOpenCount, rootsDoneCount }) {
  return (
    <section className="metaRow">
      <div className="fixed-meta" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>Open: <b className="mono">{rootsOpenCount}</b></span>
        <span>Completed: <span className="mono">{rootsDoneCount}</span></span>
      </div>
    </section>
  );
}
