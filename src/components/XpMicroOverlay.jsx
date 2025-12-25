import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useXpGainListener } from "../core/xpEvents.js";
import { levelFromXP, XP_META } from "../core/multixp.js";
import "./XpMicroOverlay.css";

const clampPct = (n) => Math.min(100, Math.max(0, n || 0));
const formatNum = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString() : "0";

function useAnimatedNumber(target = 0, duration = 400) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const start = val;
    const dest = Number.isFinite(target) ? target : 0;
    const delta = dest - start;
    if (Math.abs(delta) < 0.01) { setVal(dest); return; }
    const startTs = performance.now();
    const dur = Math.max(180, duration);
    let raf;
    const step = (ts) => {
      const t = Math.min(1, (ts - startTs) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(start + delta * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

function computeLevelPct(xpValue = 0) {
  const { into, span } = levelFromXP(Math.max(0, xpValue || 0));
  if (!span) return 0;
  return clampPct((into / span) * 100);
}

function findAnchor(taskId, parentId) {
  if (typeof document === "undefined") return null;
  const ids = [taskId, parentId].filter(Boolean);
  for (const id of ids) {
    const el = document.querySelector(`[data-xp-anchor="${id}"]`);
    if (el) return el;
  }
  return null;
}

export default function XpMicroOverlay() {
  const [state, setState] = useState(null);
  const hideTimer = useRef(null);
  const barTimer = useRef(null);
  const [barReady, setBarReady] = useState(false);
  const [deltaOn, setDeltaOn] = useState(false);

  const hide = useCallback(() => {
    setState((prev) => prev ? { ...prev, visible: false } : prev);
    hideTimer.current && clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setState(null), 350);
  }, []);

  useEffect(() => () => {
    hide();
    barTimer.current && clearTimeout(barTimer.current);
  }, [hide]);

  useXpGainListener((evt) => {
    const anchor = findAnchor(evt?.taskId, evt?.parentId);
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const top = rect.top + window.scrollY - 12; // float just above checkbox
    const left = rect.left + rect.width / 2 + window.scrollX;

    const globalBefore = Math.max(0, evt?.totals?.globalBefore || 0);
    const globalAfter = Math.max(0, evt?.totals?.globalAfter || 0);
    const pctBefore = computeLevelPct(globalBefore);
    const pctAfter = computeLevelPct(globalAfter);
    const pctDelta = Math.max(0, pctAfter - pctBefore);

    const branches = Object.entries(evt?.delta?.branches || {})
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, val]) => ({
        key,
        val: Math.round(val),
        color: XP_META[key]?.color || "var(--accent)",
      }));

    const payload = {
      id: evt?.id || `xp:${Date.now()}`,
      top,
      left,
      questType: evt?.questType,
      globalDelta: Math.max(0, Math.round(evt?.delta?.global || 0)),
      before: globalBefore,
      after: globalAfter,
      pctBefore,
      pctAfter,
      pctDelta,
      branches,
    };

    setState({ ...payload, visible: true });
    setBarReady(false);
    setDeltaOn(false);
    barTimer.current && clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => {
      setBarReady(true);
      requestAnimationFrame(() => setDeltaOn(true));
    }, 140); // wait for card to pop in
    hideTimer.current && clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, 2000);
  });

  const overlayStyle = useMemo(() => {
    if (!state) return { opacity: 0, pointerEvents: "none" };
    return {
      top: state.top,
      left: state.left,
      transform: "translate(-50%, -110%)",
      opacity: state.visible ? 1 : 0,
    };
  }, [state]);

  const animatedTotal = useAnimatedNumber(state?.after || 0, 520);

  if (!state) return null;

  return createPortal(
    <div className="xp-micro" style={overlayStyle}>
      <div className="xp-micro-card">
        <div className="xp-micro-head">
          <div className="mono">+{formatNum(state.globalDelta)} XP</div>
          {state.questType && <span className="badge">{state.questType}</span>}
        </div>
        <div className="xp-micro-bar">
          <div
            className="xp-micro-bar-fill"
            style={{ width: `${barReady ? state.pctAfter : state.pctBefore}%` }}
          />
          {state.pctDelta > 0 && (
            <div
              className="xp-micro-bar-delta"
              style={{
                left: `${state.pctBefore}%`,
                width: deltaOn ? `${state.pctDelta}%` : 0,
              }}
            />
          )}
          <div className="xp-micro-bar-caption mono">
            {formatNum(state.before)} -> {formatNum(animatedTotal)}
          </div>
        </div>
        {state.branches.length > 0 && (
          <div className="xp-micro-branches">
            {state.branches.map((b) => (
              <span key={b.key} className="xp-micro-branch" style={{ borderColor: b.color }}>
                <span className="dot" style={{ background: b.color }} />
                {b.key} +{formatNum(b.val)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
