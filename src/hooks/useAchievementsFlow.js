// src/hooks/useAchievementsFlow.js
import { useEffect, useState, useCallback, useRef } from "react";
import { evaluateAchievements } from "../core/achievements.js";
import { getAchievementAnimation } from "../core/achievementAnimations.js";

export default function useAchievementsFlow({ tasks, level, ach, settings }, { setAch, setXp }, lastActionRef) {
  const [anim, setAnim] = useState({ visible: false, url: "", message: "" });
  const [achQueue, setAchQueue] = useState([]);
  const achSnapshotRef = useRef(JSON.stringify(ach || {}));
  const dismissAnim = useCallback(() => setAnim({ visible: false, url: "", message: "" }), []);
  const resetAnimState = useCallback(() => {
    setAchQueue([]);
    setAnim({ visible: false, url: "", message: "" });
  }, []);

  const isAwardAllowed = () => ["complete", "daily", "weekly"].includes(lastActionRef.current || "");

  useEffect(() => {
    achSnapshotRef.current = JSON.stringify(ach || {});
  }, [ach]);

  useEffect(() => {
    const ctx = { tasks, level };
    const next = evaluateAchievements(ctx, ach, (payload) => {
      if (!isAwardAllowed()) return;
      try {
        const globalDelta = Number(payload?.global || 0);
        const multi = payload?.multi && typeof payload.multi === "object" ? payload.multi : null;
        const reason = payload?.reason || "Achievement";
        if (globalDelta) setXp(prev => prev + globalDelta);
        if (multi && Object.keys(multi).length) {
          // side-effectful award handled at award time elsewhere
        }
        const m = /^Achievement:\s*(.+)$/.exec(reason);
        const label = m ? m[1] : null;
        if ((settings?.animations !== false) && label) {
          const conf = getAchievementAnimation(label);
          if (conf?.url) setAchQueue(q => [...q, { url: conf.url, message: conf.message || label }]);
        }
      } catch (e) { console.warn("Achievement awardFn failed:", e); }
    });
    const nextSnapshot = JSON.stringify(next || {});
    if (nextSnapshot !== achSnapshotRef.current) {
      achSnapshotRef.current = nextSnapshot;
      setAch(next);
    }
    lastActionRef.current = null;
  }, [tasks, level, ach, settings?.animations, setAch, setXp, lastActionRef]);

  useEffect(() => {
    if (!achQueue || !Array.isArray(achQueue)) return;
    if (anim && (anim.visible || anim.url)) return;
    if (!achQueue.length) return;
    const nxt = achQueue[0];
    setAnim({ visible: true, url: nxt.url, message: nxt.message });
    setAchQueue(q => q.slice(1));
  }, [anim?.visible, anim?.url, achQueue]);

  return { anim, dismissAnim, resetAnimState };
}
