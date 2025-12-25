// src/hooks/useLevelProgress.js
import { useEffect, useMemo, useRef, useState } from "react";
import { levelProgress } from "../core/gamify.js";

export default function useLevelProgress(xp, animationsEnabled) {
  const { level, into, span, nextIn } = useMemo(() => levelProgress(xp), [xp]);
  const progressPct = Math.min(100, (into / Math.max(1, span)) * 100);
  const prevLevelRef = useRef(level);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!animationsEnabled) { prevLevelRef.current = level; return; }
    if (level > prevLevelRef.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1500);
      prevLevelRef.current = level;
      return () => clearTimeout(t);
    }
    prevLevelRef.current = level;
  }, [level, animationsEnabled]);

  return { level, into, span, nextIn, progressPct, celebrate };
}