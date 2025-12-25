// src/hooks/useTaskGc.js
import { useEffect } from "react";
import { ts } from "../app/app.merge.js";

export default function useTaskGc(tasks, setTasks) {
  useEffect(() => {
    const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const cutoff = Date.now() - TTL_MS;
    let needsPurge = false;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t && t.deleted) {
        const del = ts(t.deletedAt);
        if (del && del < cutoff) { needsPurge = true; break; }
      }
    }
    if (!needsPurge) return;
    setTasks(prev => {
      const out = prev.filter(t => {
        if (!t?.deleted) return true;
        const del = ts(t.deletedAt);
        return !(del && del < cutoff);
      });
      return out.length === prev.length ? prev : out;
    });
  }, [tasks, setTasks]);
}