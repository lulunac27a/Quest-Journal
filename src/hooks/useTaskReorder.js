// src/hooks/useTaskReorder.js
import { useEffect, useState } from "react";

export default function useTaskReorder(tasks, setTasks) {
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [reSrcId, setReSrcId] = useState(null); // source id
  const [reOverId, setReOverId] = useState(null); // current hover id
  const reorderActive = reSrcId !== null;

  function startDragTask(id) { setDragId(id); }
  function dragOverTask(id, e) { e?.preventDefault?.(); if (dragOverId !== id) setDragOverId(id); }
  function endDragTask() { setDragId(null); setDragOverId(null); }
  function dropOnTask(targetId) {
    if (!dragId || dragId === targetId) { endDragTask(); return; }
    setTasks(prev => {
      const srcIdx = prev.findIndex(x => x.id === dragId);
      const dstIdx = prev.findIndex(x => x.id === targetId);
      if (srcIdx === -1 || dstIdx === -1) return prev;
      const s = prev[srcIdx]; const d = prev[dstIdx];
      // Only reorder root tasks within same list and same done-state
      if (s.parentId || d.parentId) return prev;
      if (s.listId !== d.listId) return prev;
      if (!!s.done !== !!d.done) return prev;
      const arr = prev.slice();
      const [item] = arr.splice(srcIdx, 1);
      const insertAt = arr.findIndex(x => x.id === targetId);
      if (insertAt === -1) return prev;
      arr.splice(insertAt, 0, item);
      // assign sortIndex for this list+done roots
      const ids = [];
      for (const t of arr) {
        if (!t.parentId && !t.deleted && t.listId === s.listId && !!t.done === !!s.done) ids.push(t.id);
      }
      const idToIndex = new Map(ids.map((id,i)=>[id,i]));
      return arr.map(t => {
        if (!t.parentId && !t.deleted && t.listId === s.listId && !!t.done === !!s.done) {
          const idx = idToIndex.get(t.id);
          return { ...t, sortIndex: idx, updatedAt: (t.updatedAt || new Date().toISOString()) };
        }
        return t;
      });
    });
    endDragTask();
  }

  // Double-click reorder
  function beginReorder(id) {
    const t = tasks.find(x => x.id === id);
    if (!t || t.parentId || t.done) return;
    setReSrcId(id);
    setReOverId(id);
  }
  function hoverReorder(id) {
    if (!reorderActive) return;
    if (id === reOverId) return;
    const src = tasks.find(x => x.id === reSrcId);
    const dst = tasks.find(x => x.id === id);
    if (!src || !dst) return;
    if (src.parentId || dst.parentId) return;
    if (src.listId !== dst.listId) return;
    if (!!src.done !== !!dst.done) return;
    setReOverId(id);
  }
  function cancelReorder() { setReSrcId(null); setReOverId(null); }
  function commitReorder() {
    if (!reorderActive) return cancelReorder();
    const srcId = reSrcId; const dstId = reOverId;
    if (!srcId || !dstId || srcId === dstId) { return cancelReorder(); }
    setTasks(prev => {
      const srcIdx = prev.findIndex(x => x.id === srcId);
      const dstIdx = prev.findIndex(x => x.id === dstId);
      if (srcIdx === -1 || dstIdx === -1) return prev;
      const s = prev[srcIdx]; const d = prev[dstIdx];
      if (s.parentId || d.parentId) return prev;
      if (s.listId !== d.listId) return prev;
      if (!!s.done !== !!d.done) return prev;
      const arr = prev.slice();
      const [item] = arr.splice(srcIdx, 1);
      const insertAt = arr.findIndex(x => x.id === dstId);
      if (insertAt === -1) return prev;
      arr.splice(insertAt, 0, item);
      const ids = [];
      for (const t of arr) {
        if (!t.parentId && !t.deleted && t.listId === s.listId && !!t.done === !!s.done) ids.push(t.id);
      }
      const idToIndex = new Map(ids.map((id,i)=>[id,i]));
      return arr.map(t => {
        if (!t.parentId && !t.deleted && t.listId === s.listId && !!t.done === !!s.done) {
          const idx = idToIndex.get(t.id);
          return { ...t, sortIndex: idx, updatedAt: (t.updatedAt || new Date().toISOString()) };
        }
        return t;
      });
    });
    cancelReorder();
  }
  function clickReorderTarget(id) { if (!reorderActive) return; hoverReorder(id); commitReorder(); }

  useEffect(() => {
    if (!reorderActive) return;
    function onUp(){ commitReorder(); }
    function onKey(e){ if (e.key === 'Escape') cancelReorder(); }
    function onMove(e){
      try {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const row = el && (el.closest ? el.closest('.task[data-id]') : null);
        const id = row && row.getAttribute ? row.getAttribute('data-id') : null;
        if (id) hoverReorder(id);
      } catch {}
    }
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove);
    };
  }, [reorderActive, reSrcId, reOverId]);

  return {
    // state
    reorderActive,
    reSrcId,
    reOverId,
    dragId,
    dragOverId,
    // drag handlers
    startDragTask,
    dragOverTask,
    endDragTask,
    dropOnTask,
    // dblclick reorder
    beginReorder,
    hoverReorder,
    clickReorderTarget,
    cancelReorder,
  };
}