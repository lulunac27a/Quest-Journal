// src/components/ListsToolbar.jsx
export default function ListsToolbar({ lists, activeListId, setActiveListId, listMenuOpen, setListMenuOpen, setLists, setTasks, uid }) {
  return (
    <section className="lists-toolbar">
      <div className="lists-toolbar__chips">
        {lists.map((l) => (
          <button
            key={l.id}
            className={`btn ${l.id === activeListId ? "active" : ""}`}
            onClick={() => setActiveListId(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="lists-toolbar__menu" style={{ position: "relative" }}>
        <button
          className="btn"
          aria-haspopup="menu"
          aria-expanded={listMenuOpen}
          onClick={() => setListMenuOpen((o) => !o)}
          title="List options"
        >
          ...
        </button>
        {listMenuOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "110%",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 10px 26px rgba(0,0,0,.12)",
              padding: 6,
              display: "grid",
              gap: 6,
              zIndex: 20,
              minWidth: 160,
            }}
          >
            <button
              className="btn"
              role="menuitem"
              onClick={() => {
                setListMenuOpen(false);
                const name = prompt("New list name:");
                if (!name) return;
                const id = uid();
                setLists((p) => [...p, { id, name }]);
                setActiveListId(id);
              }}
            >
              + New list
            </button>
            <button
              className="btn"
              role="menuitem"
              onClick={() => {
                setListMenuOpen(false);
                const l = lists.find((x) => x.id === activeListId);
                if (!l) return;
                const name = prompt("Rename list:", l.name);
                if (name && name !== l.name) setLists((p) => p.map((it) => (it.id === l.id ? { ...it, name } : it)));
              }}
            >
              Rename
            </button>
            {activeListId !== "inbox" && (
              <button
                className="btn"
                role="menuitem"
                onClick={() => {
                  setListMenuOpen(false);
                  if (!confirm("Delete this list and all its tasks?")) return;
                  setLists((p) => p.filter((l) => l.id !== activeListId));
                  setTasks((p) => p.filter((t) => t.listId !== activeListId));
                  setActiveListId("inbox");
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
