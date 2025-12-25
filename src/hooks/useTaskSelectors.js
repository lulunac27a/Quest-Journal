// src/hooks/useTaskSelectors.js
import { useMemo } from "react";

const EMPTY_CHILDREN = Object.freeze([]);

export default function useTaskSelectors(tasks, activeListId, reorderActive) {
  const childrenMap = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      if (!task?.parentId || task.deleted) continue;
      const list = map.get(task.parentId);
      if (list) {
        list.push(task);
      } else {
        map.set(task.parentId, [task]);
      }
    }
    for (const group of map.values()) {
      group.sort((a, b) => {
        const ax = (a?.createdAt || "");
        const bx = (b?.createdAt || "");
        if (ax === bx) return 0;
        return ax < bx ? -1 : 1;
      });
    }
    return map;
  }, [tasks]);

  const childrenOf = (id) => childrenMap.get(id) || EMPTY_CHILDREN;

  const rootsOpen = useMemo(() => {
    const arr = tasks.filter(t => !t.parentId && !t.deleted && (activeListId === "all" || t.listId === activeListId) && !t.done);
    if (reorderActive) {
      return arr.slice().sort((a,b)=>{
        const ai = Number.isFinite(a?.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
        const bi = Number.isFinite(b?.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
    }
    const withDue = [];
    const noDue = [];
    for (const t of arr) {
      if (t?.deadline) withDue.push(t); else noDue.push(t);
    }
    withDue.sort((a,b)=>{
      const ad = Date.parse(a.deadline || 0) || 0;
      const bd = Date.parse(b.deadline || 0) || 0;
      return ad - bd;
    });
    noDue.sort((a,b)=>{
      const ac = (a.createdAt || "").toString();
      const bc = (b.createdAt || "").toString();
      return bc.localeCompare(ac);
    });
    return [...withDue, ...noDue];
  }, [tasks, activeListId, reorderActive]);

  const rootsDone = useMemo(() => {
    const arr = tasks.filter(t => !t.parentId && !t.deleted && (activeListId === "all" || t.listId === activeListId) && t.done);
    return arr.slice().sort((a,b)=>{
      const ai = Number.isFinite(a?.sortIndex) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
      const bi = Number.isFinite(b?.sortIndex) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [tasks, activeListId]);

  return { childrenOf, rootsOpen, rootsDone };
}
