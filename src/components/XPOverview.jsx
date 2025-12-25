// src/components/XPOverview.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { XP_TYPES, XP_META, loadMultiXP, levelFromXP } from "../core/multixp.js";
import { useXpGainListener } from "../core/xpEvents.js";
import "./XpOverviewPulse.css";

export default function XPOverview() {
  const [mxp, setMxp] = useState(loadMultiXP());
  const [branchPulses, setBranchPulses] = useState({});
  const pulseTimers = useRef({});

  useEffect(() => {
    const on = () => setMxp(loadMultiXP());
    window.addEventListener("storage", on);
    const id = setInterval(on, 1000); // lightweight poll in local page
    return () => { window.removeEventListener("storage", on); clearInterval(id); };
  }, []);

  useEffect(() => () => {
    Object.values(pulseTimers.current || {}).forEach(clearTimeout);
  }, []);

  const handleXpGain = useCallback((evt) => {
    const entries = Object.entries(evt?.delta?.branches || {}).filter(([, val]) => Number(val) > 0);
    if (!entries.length) return;
    const updates = {};
    entries.forEach(([branch, val]) => {
      const data = { id: `${evt.id}:${branch}`, delta: Math.round(val), questType: evt?.questType };
      updates[branch] = data;
    });
    setBranchPulses((prev) => ({ ...prev, ...updates }));
    entries.forEach(([branch]) => {
      clearTimeout(pulseTimers.current[branch]);
      const data = updates[branch];
      pulseTimers.current[branch] = setTimeout(() => {
        setBranchPulses((prev) => {
          if (!prev[branch] || prev[branch].id !== data.id) return prev;
          const next = { ...prev };
          delete next[branch];
          return next;
        });
      }, 1500);
    });
  }, []);

  useXpGainListener(handleXpGain);

  return (
    <div className="xp-overview">
      {XP_TYPES.map(t => {
        const val = mxp.xp[t] || 0;
        const meta = XP_META[t];
        const { level, into, span } = levelFromXP(val);
        const pct = span ? Math.min(100, Math.round((into / span) * 100)) : 0;
        const pulseInfo = branchPulses[t];
        return (
          <div key={t} className={`xp-pill ${pulseInfo ? "xp-branch-pulse" : ""}`}>
            <span className="xp-ico" style={{ background: meta.color }}>{meta.icon}</span>
            <div className="xp-info">
              <div className="xp-name">{t}</div>
              <div className="xp-meta">
                <span className="mono">Lv {level}</span>
                <span className="mono">{val} XP</span>
              </div>
              <div className="xp-bar">
                <div
                  className={`xp-bar-fill ${pulseInfo ? "pulse" : ""}`}
                  style={{ width: `${pct}%`, background: meta.color }}
                />
                {pulseInfo && (
                  <div className="xp-branch-overlay mono">
                    +{pulseInfo.delta}
                  </div>
                )}
                {pulseInfo && <div className="xp-branch-sheen" aria-hidden />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
