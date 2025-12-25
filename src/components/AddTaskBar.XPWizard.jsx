import React, { useEffect, useMemo, useState } from "react";
import { suggestXP, bandFor } from "../core/xpSuggest.js";
import { QUEST_TYPES, QUEST_UNITS_LABEL } from "../core/constants.js";

export function XPWizard({
  level = 1,
  buffs,
  initQuestType = "BASIC",
  initDuration = 1,
  initSliders = null,
  typeLocked = () => false,
  onCancel,
  onApply,
  onSlidersChange,
}) {
  const [questType, setQuestType] = useState(initQuestType);
  const normalizedInitDuration = Number(initDuration);
  const initHasDuration = Number.isFinite(normalizedInitDuration) && normalizedInitDuration > 0;
  const [duration, setDuration] = useState(() => (initHasDuration ? normalizedInitDuration : 1));
  const [durTouched, setDurTouched] = useState(initHasDuration && normalizedInitDuration !== 1);

  const _init = initSliders || {};
  const [difficulty, setDifficulty] = useState(_init.difficulty ?? 50);
  const [importance, setImportance] = useState(_init.importance ?? 50);
  const [energy, setEnergy]       = useState(_init.energy ?? 50);
  const [pride, setPride]         = useState(_init.pride ?? 50);
  useEffect(() => { onSlidersChange?.({ difficulty, importance, energy, pride }); }, [difficulty, importance, energy, pride, onSlidersChange]);

  const suggested = useMemo(
    () => suggestXP({ questType, duration, sliders: { difficulty, importance, energy, pride }, level }),
    [questType, duration, difficulty, importance, energy, pride, level]
  );
  const range = useMemo(() => bandFor(suggested), [suggested]);

  const [chosen, setChosen] = useState(suggested);
  const [xpTouched, setXpTouched] = useState(false);
  useEffect(() => { setXpTouched(false); }, [suggested]);
  useEffect(() => {
    const { min, max } = range;
    setChosen(prev => {
      const source = xpTouched ? prev : suggested;
      const base = Number.isFinite(source) ? source : suggested;
      return Math.min(max, Math.max(min, base));
    });
  }, [range, suggested, xpTouched]);

  const step = 1;
  const gMul = buffs?.globalMul || 1;
  const gDelta = Math.max(0, Math.round(chosen * (gMul - 1)));

  const unit = QUEST_TYPES[questType]?.unit || "h";
  const unitLabel = QUEST_UNITS_LABEL[unit] || "hours";
  const durCfg = useMemo(() => {
    switch (questType) {
      case "BASIC": return { min: 1, max: 120, step: 1, sliderMax: 120 };
      case "SIDE":  return { min: 1, max: 24, step: 1, sliderMax: 24 };
      case "MAIN":  return { min: 1, max: 30, step: 1, sliderMax: 30 };
      case "EPIC":  return { min: 1, max: 8, step: 1, sliderMax: 8 };
      default:      return { min: 1, max: 24, step: 1, sliderMax: 24 };
    }
  }, [questType]);

  const durMin = durCfg.min;
  const durMax = durCfg.max;
  useEffect(() => {
    setDuration(prev => {
      const base = Number.isFinite(prev) ? prev : durMin;
      const clamped = Math.min(durMax, Math.max(durMin, base));
      return durTouched ? clamped : durMin;
    });
  }, [durMin, durMax, durTouched]);

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const fieldStyle = isDark ? { backgroundColor: "#10254fff", color: "#98a5c5ff" } : {};

  return (
    <div style={{ display:"grid", gap:12 }}>
      <div className="sf-card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="hint" style={{ marginRight: 6 }}>Quest Type:</div>
        {["BASIC","SIDE","MAIN","EPIC"].map(q => {
          const t = QUEST_TYPES[q];
          const locked = typeLocked(q);
          const titleText = locked ? `Unlock at Lv ${t?.unlockLvl}` : t.label;
          return (
            <button
              key={q}
              className={`tab ${questType===q ? "active" : ""}`}
              onClick={() => !locked && setQuestType(q)}
              title={titleText}
              disabled={locked}
              style={{ position: "relative" }}
              aria-label={titleText}
            >
              {t.label}
              {locked && (
                <span className="hint" style={{ marginLeft: 6 }} aria-hidden="true" role="img">
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sf-card" style={{ padding:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div className="hint">Suggested (base)</div>
            <div className="mono" style={{ fontSize:22, fontWeight:800 }}>{suggested}</div>
            <div className="hint" style={{ marginTop:4 }}>
              Global preview: <span className="mono">+{gDelta}</span>
            </div>
          </div>

          <div style={{ flex:1, minWidth:280 }}>
            <div className="hint" style={{ marginBottom:4 }}>
              Pick base XP: <b className="mono">{range.min.toLocaleString()}</b> - <b className="mono">{range.max.toLocaleString()}</b>
            </div>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={step}
              value={chosen}
              onChange={e => {
                setXpTouched(true);
                setChosen(parseInt(e.target.value, 10));
              }}
              style={{ width:"100%" }}
            />
          </div>

          <div style={{ width:170, textAlign:"right" }}>
            <div className="hint">Base XP</div>
            <div className="mono" style={{ fontSize:20, fontWeight:800 }}>
              {chosen} {gDelta>0 ? <span className="hint" style={{ fontSize:14 }}>(+{gDelta})</span> : null}
            </div>
            <input
              className="xpInput"
              type="number"
              min={range.min}
              max={range.max}
              step={step}
              value={chosen}
              onChange={e => {
                setXpTouched(true);
                const n = parseInt(e.target.value || 0, 10);
                if (!Number.isFinite(n)) return;
                setChosen(Math.min(range.max, Math.max(range.min, n)));
              }}
              style={fieldStyle}
            />
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
        <QBlock label="How difficult was this task?" value={difficulty} setValue={setDifficulty} fieldStyle={fieldStyle} />
        <QBlock label="How important/critical was it?" value={importance} setValue={setImportance} fieldStyle={fieldStyle} />
        <QBlock label="How much energy did it take?"   value={energy}     setValue={setEnergy}     fieldStyle={fieldStyle} />
        <QBlock label="How proud/satisfied are you with doing it?" value={pride} setValue={setPride} fieldStyle={fieldStyle} />
        <div className="sf-card" style={{ padding:12 }}>
          <div className="hint">How many {unitLabel} will it take?</div>
          <input
            type="number"
            min={durCfg.min}
            max={durCfg.max}
            step={durCfg.step}
            value={duration}
            onChange={(e) => { setDurTouched(true); setDuration(Math.max(durCfg.min, Math.min(durCfg.max, Number(e.target.value || 0)))) }}
            style={{ width:"100%", margin:"6px 0", ...fieldStyle }}
          />
          <input
            type="range"
            min={durCfg.min}
            max={durCfg.sliderMax}
            step={durCfg.step}
            value={Math.min(durCfg.sliderMax, duration)}
            onChange={(e) => { setDurTouched(true); setDuration(Number(e.target.value)); }}
            style={{ width:"100%" }}
          />
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button
          className="btn primary"
          onClick={() => onApply({
            xpBase: chosen,
            questType,
            duration,
            openMilestones: ["MAIN","EPIC"].includes(questType),
          })}
        >
          Continue {["MAIN","EPIC"].includes(questType) ? "-> Milestones" : "-> Allocate"}
        </button>
      </div>
    </div>
  );
}

function QBlock({ label, value, setValue, fieldStyle }) {
  return (
    <div className="sf-card" style={{ padding:12 }}>
      <div className="hint">{label}</div>
      <input
        type="number" min={1} max={100}
        value={value}
        onChange={e => setValue(Math.max(1, Math.min(100, parseInt(e.target.value || "1", 10))))}
        style={{ width:"100%", margin:"6px 0", ...fieldStyle }}
      />
      <input
        type="range" min={1} max={100}
        value={value}
        onChange={e => setValue(parseInt(e.target.value, 10))}
        style={{ width:"100%" }}
      />
    </div>
  );
}
