// src/app/app.lists.js
export function ensureListsPresent(arr) {
  const ids = new Set((arr || []).map(x => x?.id));
  const out = Array.isArray(arr) ? arr.slice() : [];
  if (!ids.has("all")) out.push({ id: "all", name: "All Quests" });
  if (!ids.has("inbox")) out.push({ id: "inbox", name: "Inbox" });
  const seen = new Set();
  return out.filter(x => {
    const id = x?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return !!x?.name;
  });
}
export function coerceActiveId(activeId, lists) {
  const has = (lid) => lists.some(x => x.id === lid);
  if (has(activeId)) return activeId;
  if (has("main")) return "main";
  if (has("inbox")) return "inbox";
  return (lists[0]?.id) || "main";
}