import React from "react";
import TaskRow from "./TaskRow.jsx";

// TemplateRow renders a template using the same TaskRow UI,
// but replaces the leading checkbox with an Activate button.
export default function TemplateRow({ tpl, lists = [], onActivate, onUpdate }) {
  const targetListId = tpl.toListId || tpl.listId || (lists.find(l => l.id === 'main')?.id) || (lists[0]?.id) || 'main';

  // Map template to TaskRow shape; keep done=false and root level
  const t = {
    id: tpl.id,
    title: tpl.title,
    desc: tpl.description ?? tpl.desc ?? "",
    questType: tpl.questType || 'BASIC',
    baseXp: tpl.xpBase ?? tpl.baseXp ?? tpl.xp ?? 1,
    xp: tpl.xpBase ?? tpl.baseXp ?? tpl.xp ?? 1,
    xpBase: tpl.xpBase ?? tpl.baseXp ?? tpl.xp ?? 1,
    xpAwards: tpl.xpAwards,
    subtasks: tpl.subtasks,
    createdAt: tpl.createdAt || new Date().toISOString(),
    deadline: tpl.absoluteDue || null,
    deadlineLocked: !!tpl.deadlineLocked,
    parentId: null,
    listId: targetListId,
    done: false,
  };

  const leading = (
    <button className="btn primary" onClick={() => onActivate?.(tpl)} title="Activate template" type="button">
      Activate
    </button>
  );

  function handleUpdate(id, fields) {
    const patch = { ...fields };
    if (Object.prototype.hasOwnProperty.call(patch, 'listId')) {
      patch.toListId = patch.listId; // remap destination list
      delete patch.listId;
    }
    onUpdate?.(tpl.id, patch);
  }

  return (
    <div>
      <TaskRow
        t={t}
        childrenOf={() => []}
        onToggle={() => {}}
        onRemove={() => {}}
        onAddSubtask={() => {}}
        onMilestoneToggle={() => {}}
        onRenameTitle={(id, newTitle) => handleUpdate(id, { title: newTitle })}
        onUpdate={handleUpdate}
        lists={lists}
        draggable={false}
        reorderActive={false}
        isReorderSrc={false}
        isDragOver={false}
        timeLeft={() => null}
        leading={leading}
      />
      <div className="hint" style={{ marginTop: 6 }}>
        Will go to: {lists.find(l => l.id === targetListId)?.name || 'main quests'}
      </div>
    </div>
  );
}

