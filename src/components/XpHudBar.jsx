import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLatestXpGain } from "../core/xpEvents.js";
import "./XpHudBar.css";

function useAnimatedValue(target = 0, duration = 550) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(safeTarget);
  const valueRef = useRef(safeTarget);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let raf;
    const startValue = valueRef.current;
    const delta = safeTarget - startValue;
    if (Math.abs(delta) < 0.01) {
      valueRef.current = safeTarget;
      setValue(safeTarget);
      return () => {};
    }
    const startTs = performance.now();
    const durationMs = Math.max(120, duration);
    const step = (ts) => {
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValue + delta * eased;
      valueRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, duration]);

  return value;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

export default function XpHudBar({ xp = 0, nextIn = 0, progressPct = 0 }) {
  const gain = useLatestXpGain();
  const [pulseData, setPulseData] = useState(null);
  const [pulseActive, setPulseActive] = useState(false);

  const animatedXp = useAnimatedValue(xp, 520);
  const animatedNextIn = useAnimatedValue(nextIn, 520);
  const animatedPct = useAnimatedValue(
    Math.min(100, Math.max(0, Number(progressPct) || 0)),
    620
  );

  useEffect(() => {
    if (!gain) return undefined;
    const globalDelta = Math.max(0, parseInt(gain?.delta?.global || 0, 10) || 0);
    const branchEntries = Object.entries(gain?.delta?.branches || {})
      .filter(([, val]) => Number(val) > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([key, val]) => ({ key, val: Math.round(val) }));
    if (globalDelta <= 0 && branchEntries.length === 0) {
      setPulseData(null);
      setPulseActive(false);
      return undefined;
    }
    setPulseData({
      id: gain.id,
      globalDelta,
      questType: gain.questType,
      branchEntries,
    });
    setPulseActive(true);
    const fadeTimer = setTimeout(() => setPulseActive(false), 800);
    const clearTimer = setTimeout(() => setPulseData(null), 1600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [gain?.id]);

  const branchLabel = useMemo(() => {
    if (!pulseData?.branchEntries?.length) return null;
    return pulseData.branchEntries
      .map(({ key, val }) => `${key} +${val}`)
      .join(" • ");
  }, [pulseData]);

  return (
    <>
      <div className="stats xp-hud-stats">
        <div className="stat">
          <div className="label">Legacy XP</div>
          <div className="value mono">{formatNumber(animatedXp)}</div>
        </div>
        <div className="stat">
          <div className="label">Next Level</div>
          <div className="value mono">{formatNumber(animatedNextIn)} XP</div>
        </div>
        <div className="stat">
          <div className="label">Progress</div>
          <div className="value mono">{formatNumber(animatedPct)}%</div>
        </div>
      </div>

      <div
        className={`progress-shell xp-hud-shell ${pulseActive ? "pulse" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, Math.max(0, animatedPct)))}
        aria-label="XP progress"
      >
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(100, Math.max(0, animatedPct))}%`,
            transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {pulseActive && pulseData && (
          <div key={pulseData.id} className="xp-pulse-wave" aria-hidden />
        )}
      </div>
    </>
  );
}
