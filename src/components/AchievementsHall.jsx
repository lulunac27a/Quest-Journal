// src/components/AchievementsHall.jsx
// Full achievements hall with filters/search/sort/grouping

import React, { useEffect, useMemo, useState } from "react";
import { ACH_CATALOG } from "../core/achievements.js";
import { PERK_RULES } from "../core/perkRules.data.js";
import { loadMultiXP, XP_META } from "../core/multixp.js";

// Catalog index by id (used to prefer latest icon/label for display)
const CATALOG_BY_ID = (() => {
  try {
    const map = {};
    (ACH_CATALOG || []).forEach((it) => { if (it && it.id) map[it.id] = it; });
    return map;
  } catch {
    return {};
  }
})();

const TYPE_LABEL = {
  productivity: "Productivity",
  social: "Social",
  learning: "Learning",
  health: "Health",
  strength: "Strength",
  trade: "Trade",
  athletics: "Athletics",
  journal: "Journal",
  daily: "Daily",
  weekly: "Weekly",
  evergreen: "All-Time",
  time: "Time-of-Day",
  meta: "Meta",
};

const TYPE_ICON = {
  productivity: "🗂️",
  social: "😊",
  learning: "🧠",
  health: "🩺",
  strength: "🥊",
  trade: "💼",
  athletics: "🏃",
  daily: "📅",
  weekly: "📆",
  evergreen: "🏆",
  time: "⏰",
  meta: "🧩",
};

const ICON_BY_ID = {
  // All-Time: Levels
  lvl_5: "🥉", lvl_10: "🥈", lvl_20: "🥇", lvl_30: "🏆",
  // All-Time: Totals
  tot_10: "📌", tot_50: "🧰", tot_200: "⚙️", tot_500: "🚀",
  // Weekly
  week_steps: "👟", week_7: "🗓️", week_14: "📆", week_21: "📈", week_28: "🏅",
  // Athletics refinements
  ath_5: "🥾", ath_10: "🚴", ath_20: "🥇",
  // Health
  health_20: "🫀",
  // Productivity legend
  prod_10: "🔥",
};

function resolveIcon(a) {
  const raw = a?.icon;
  if (ICON_BY_ID[a?.id]) return ICON_BY_ID[a.id];
  if ((a?.type === "time") && typeof raw === "string" && raw.length <= 4) return raw; // AM/SUN/OWL
  const looksLikeCode = typeof raw === "string" && /^[A-Z0-9+]{1,4}$/.test(raw);
  if (!raw || looksLikeCode) return TYPE_ICON[a?.type] || "🏆";
  return raw;
}

// ---------- Buff helpers ----------
function getPerkRuleForAch(achId) {
  return PERK_RULES.find((r) => r.source?.type === "ach" && r.source.achId === achId);
}

function formatBuffFromRule(rule, achItem, perkTiers) {
  if (!rule) return null;

  if (rule.effects) {
    if (typeof rule.effects.globalMult === "number") {
      const pct = Math.round((rule.effects.globalMult - 1) * 100);
      return { label: `+${pct}% Global` };
    }
    if (rule.effects.branchMult) {
      const [br, m] = Object.entries(rule.effects.branchMult)[0] || [];
      if (br && typeof m === "number") {
        const pct = Math.round((m - 1) * 100);
        return { label: `+${pct}% ${br}`, branch: br, color: XP_META?.[br]?.color };
      }
    }
  }

  if (rule.tiered) {
    const tier = Math.max(1, perkTiers?.[rule.id] || achItem?.tier || 1);
    const base = rule.tiered.baseMult || 1.0;
    const step = rule.tiered.perTier || 0.0;
    const mult = base * (1 + (tier - 1) * step);
    const pct = Math.round((mult - 1) * 100);
    if (rule.tiered.branch) {
      const br = rule.tiered.branch;
      return { label: `+${pct}% ${br} (T${tier})`, branch: br, color: XP_META?.[br]?.color };
    } else {
      return { label: `+${pct}% Global (T${tier})` };
    }
  }
  return null;
}

function formatPerkDescription(rule, achItem, perkTiers) {
  if (!rule) return null;
  if (rule.effects) {
    if (typeof rule.effects.globalMult === "number") {
      const pct = Math.round((rule.effects.globalMult - 1) * 100);
      return `🎁 Perk: +${pct}% Global XP`;
    }
    if (rule.effects.branchMult) {
      const [br, m] = Object.entries(rule.effects.branchMult)[0] || [];
      if (br && typeof m === "number") {
        const pct = Math.round((m - 1) * 100);
        return `🎁 Perk: +${pct}% ${br} XP`;
      }
    }
  }
  if (rule.tiered) {
    const tier = Math.max(1, perkTiers?.[rule.id] || achItem?.tier || 1);
    const base = rule.tiered.baseMult || 1.0;
    const step = rule.tiered.perTier || 0.0;
    const mult = base * (1 + (tier - 1) * step);
    const pct = Math.round((mult - 1) * 100);
    if (rule.tiered.branch) {
      const br = rule.tiered.branch;
      return `🎁 Perk: +${pct}% ${br} XP (Tier ${tier})`;
    } else {
      return `🎁 Perk: +${pct}% Global XP (Tier ${tier})`;
    }
  }
  return null;
}

function usePerkTiers() {
  const multi = loadMultiXP();
  return multi?.perkTiers || {};
}

// ---------- Card ----------
function AchCard({ a, buff, perkDescription }) {
  const locked = a.unlocked === false;

  return (
    <div
      className="ach-card"
      title={`${a.label}${a.tier ? ` (Tier ${a.tier})` : ""}${locked ? " • Locked" : ""}`}
      style={{
        display: "grid", gap: 8, padding: 12, borderRadius: 12,
        border: "1px solid var(--border)", background: "var(--card)",
        boxShadow: "0 4px 10px rgba(0,0,0,.06)", opacity: locked ? 0.55 : 1,
        position: "relative"
      }}
    >
      {locked && (
        <div style={{ position: "absolute", top: 24, right: 8, fontSize: 11, padding: "2px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}>
          Locked
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--btn-hover)", fontSize: 18 }}>
          {resolveIcon({ ...a, icon: (CATALOG_BY_ID[a?.id]?.icon ?? a.icon) })}
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 700, lineHeight: 1.1 }}>
            {CATALOG_BY_ID[a?.id]?.label ?? a.label}
            {a.tier ? <span className="hint"> • Tier {a.tier}</span> : null}
          </div>
          <div className="hint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{TYPE_LABEL[a.type] || "General"}</span>
            {!locked && a.gainedAt ? <span>• {new Date(a.gainedAt).toLocaleString()}</span> : null}
          </div>
        </div>
      </div>

      {a.description ? (
        <div className="hint" style={{ marginTop: 2, lineHeight: 1.35 }}>
          {a.description}
          {perkDescription && (
            <div style={{ marginTop: 6, fontSize: "12px", fontWeight: 500, color: "#059669", lineHeight: 1.3, fontStyle: "italic" }}>
              {perkDescription}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function AchievementsHall({ ach }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("tier"); // tier|recent|alpha
  const [showLocked, setShowLocked] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    try {
      const mq = window.matchMedia("(max-width: 720px)");
      const sync = () => setIsNarrow(!!mq.matches);
      sync();
      mq.addEventListener?.("change", sync);
      return () => mq.removeEventListener?.("change", sync);
    } catch {
      setIsNarrow(false);
    }
  }, []);

  const perkTiers = usePerkTiers();

  // 1) Data
  const unlocked = Array.isArray(ach?.unlocked) ? ach.unlocked : [];
  const ephemeralDaily = Array.isArray(ach?.ephemeralDaily) ? ach.ephemeralDaily : [];
  const ephemeralWeekly = Array.isArray(ach?.ephemeralWeekly) ? ach.ephemeralWeekly : [];

  // Overlay unlocked on catalog
  const catalog = useMemo(() => {
    const unlockedById = new Map(unlocked.map((u) => [u.id, u]));
    const base = Array.isArray(ach?.all) ? ach.all : ACH_CATALOG;
    return base.map((a) => {
      const u = unlockedById.get(a.id) || null;
      return {
        id: a.id,
        label: a.label,
        scope: a.scope || "life",
        tier: a.tier,
        icon: a.icon,
        type: a.type,
        description: a.description,
        unlocked: !!u,
        ...(u || {}), // gainedAt, xpReward, ...
      };
    });
  }, [ach?.all, unlocked]);

  // Merge overlay + unlocked + ephemerals
  const merged = useMemo(() => {
    const map = new Map();

    for (const a of catalog) {
      map.set(a.id, { ...a, unlocked: !!a.unlocked });
    }

    for (const a of unlocked) {
      const prev = map.get(a.id);
      if (!prev || (a?.tier || 0) >= (prev?.tier || 0)) {
        map.set(a.id, { ...prev, ...a, unlocked: true });
      } else {
        map.set(a.id, { ...prev, unlocked: true, gainedAt: prev.gainedAt || a.gainedAt });
      }
    }

    ephemeralDaily.forEach((e) => {
      const prev = map.get(e.id);
      map.set(e.id, { ...prev, ...e, unlocked: true, scope: "daily" });
    });
    ephemeralWeekly.forEach((e) => {
      const prev = map.get(e.id);
      map.set(e.id, { ...prev, ...e, unlocked: true, scope: "weekly" });
    });

    return [...map.values()];
  }, [catalog, unlocked, ephemeralDaily, ephemeralWeekly]);

  const mergedWithBuff = useMemo(
    () =>
      merged.map((a) => {
        const rule = getPerkRuleForAch(a.id);
        const buff = formatBuffFromRule(rule, a, perkTiers);
        const perkDescription = formatPerkDescription(rule, a, perkTiers);
        return { ...a, __buff: buff, __perkDescription: perkDescription };
      }),
    [merged, perkTiers]
  );

  const visible = useMemo(() => {
    let list = mergedWithBuff;
    if (!showLocked) list = list.filter((a) => a.unlocked);
    if (typeFilter !== "all") list = list.filter((a) => (a.type || "evergreen") === typeFilter);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (a) => (a.label || "").toLowerCase().includes(s) || (a.description || "").toLowerCase().includes(s)
      );
    }
    list = [...list].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      switch (sortBy) {
        case "recent":
          return new Date(b.gainedAt || 0).getTime() - new Date(a.gainedAt || 0).getTime();
        case "alpha":
          return (a.label || "").localeCompare(b.label || "");
        case "tier":
        default:
          return (a.tier || 0) - (b.tier || 0); // ascending 1→4
      }
    });
    return list;
  }, [mergedWithBuff, showLocked, typeFilter, q, sortBy]);

  // Grouping for UI
  const sections = useMemo(() => {
    const generalOrder = ["Productivity", "Meta", "Time-of-Day", "Daily", "Weekly"];
    const specificOrder = ["Social", "Learning", "Health", "Strength", "Trade", "Athletics", "Journal"];
    const allTimeOrder = ["Level Ups", "Task Finisher"];

    const sec = {
      general: new Map(generalOrder.map((k) => [k, []])),
      specific: new Map(specificOrder.map((k) => [k, []])),
      alltime: new Map(allTimeOrder.map((k) => [k, []])),
    };

    for (const a of visible) {
      const t = (a.type || "").toLowerCase();
      const scope = a.scope || "life";

      // General named buckets
      if (t === "productivity") { sec.general.get("Productivity").push(a); continue; }
      if (t === "meta")        { sec.general.get("Meta").push(a); continue; }
      if (t === "time")        { sec.general.get("Time-of-Day").push(a); continue; }
      if (scope === "daily")   { sec.general.get("Daily").push(a); continue; }
      if (scope === "weekly")  { sec.general.get("Weekly").push(a); continue; }

      // Specific (branches)
      if (["social","learning","health","strength","trade","athletics","journal"].includes(t)) {
        const key = t.charAt(0).toUpperCase() + t.slice(1);
        if (sec.specific.has(key)) sec.specific.get(key).push(a);
        continue;
      }

      // All-Time split
      if (t === "evergreen") {
        if ((a.id || "").startsWith("lvl_")) sec.alltime.get("Level Ups").push(a);
        else sec.alltime.get("Task Finisher").push(a);
      }
    }
    return { generalOrder, specificOrder, allTimeOrder, ...sec };
  }, [visible]);

  // Unlocked / Total counters (based on merged)
  const totalUnlocked = useMemo(() => merged.filter(a => a.unlocked).length, [merged]);
  const totalAll = useMemo(() => (Array.isArray(ach?.all) ? ach.all.length : ACH_CATALOG.length), [ach?.all]);

  // ---- Dark-mode input text fix (no size change) ----
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const fieldStyle = isDark
    ? {
        backgroundColor: "#10254fff",
        color: "#98a5c5ff",
        transition: "background-color 0.3s ease, color 0.3s ease",
      }
    : {};

  // ✅ Make selects compact (override global width:100%)
  const baseInputStyle = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg, var(--card))",
    fontWeight: 600,
    fontSize: 13,
    lineHeight: 1.2,
    height: 36,
    minWidth: isNarrow ? 0 : 110,
    width: isNarrow ? "100%" : undefined,
    ...fieldStyle,
  };
  const selectStyle = {
    ...baseInputStyle,
    width: isNarrow ? "100%" : "auto",
    minWidth: isNarrow ? 0 : 90,
    paddingRight: 24,
  };
  const controlsWrapStyle = {
    display: "flex",
    gap: isNarrow ? 10 : 8,
    flexWrap: "wrap",
    alignItems: isNarrow ? "stretch" : "center",
    justifyContent: isNarrow ? "flex-start" : "flex-end",
    padding: isNarrow ? 8 : 4,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    width: "100%",
  };
  const headerBarStyle = {
    display: "grid",
    gridTemplateColumns: isNarrow ? "1fr" : "auto 1fr",
    alignItems: isNarrow ? "start" : "center",
    gap: isNarrow ? 10 : 12,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--card)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  };

  return (
    <div className="card achievements-hall" style={{ display: "grid", gap: 12 }}>
      {/* Header + Controls */}
      <div style={headerBarStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0 }}>Achievements Hall</h2>
          <div className="hint">{totalUnlocked} unlocked / {totalAll} total</div>
        </div>
        <div className="ach-controls" style={controlsWrapStyle}>
          <input
            type="search"
            placeholder="Search trophies."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={baseInputStyle}
            aria-label="Search trophies"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            <option value="productivity">Productivity</option>
            <option value="social">Social</option>
            <option value="learning">Learning</option>
            <option value="health">Health</option>
            <option value="strength">Strength</option>
            <option value="trade">Trade</option>
            <option value="athletics">Athletics</option>
            <option value="journal">Journal</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="evergreen">All-Time</option>
            <option value="time">Time-of-Day</option>
            <option value="meta">Meta</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={selectStyle}
            aria-label="Sort achievements"
          >
            <option value="tier">Sort: Tier</option>
            <option value="recent">Sort: Recent</option>
            <option value="alpha">Sort: A–Z</option>
          </select>
          <label
            className="hint"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 600,
              width: isNarrow ? "100%" : "auto",
            }}
          >
            <input
              type="checkbox"
              checked={showLocked}
              onChange={(e) => setShowLocked(e.target.checked)}
            />
            Show locked
          </label>
        </div>
      </div>

      {/* Sections */}
      {/* General */}
      <h2 style={{ margin: "8px 0 0 0" }}>General</h2>
      {sections.generalOrder.map((k) => (
        <section key={k} className="sf-card" style={{ borderRadius: 14 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{k}</h3>
            <span className="hint" style={{ fontSize: 13, fontWeight: 600 }}>
              {sections.general.get(k)?.length || 0} {showLocked ? "shown" : "unlocked"}
            </span>
          </header>
          <div className="ach-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {(sections.general.get(k) || []).map((a) => (
              <AchCard key={a.id} a={a} buff={a.__buff} perkDescription={a.__perkDescription} />
            ))}
          </div>
        </section>
      ))}

      {/* Specific (branches) */}
      <h2 style={{ margin: "12px 0 0 0" }}>Specific</h2>
      {sections.specificOrder.map((k) => (
        <section key={k} className="sf-card" style={{ borderRadius: 14 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{k}</h3>
            <span className="hint" style={{ fontSize: 13, fontWeight: 600 }}>
              {sections.specific.get(k)?.length || 0} {showLocked ? "shown" : "unlocked"}
            </span>
          </header>
          <div className="ach-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {(sections.specific.get(k) || []).map((a) => (
              <AchCard key={a.id} a={a} buff={a.__buff} perkDescription={a.__perkDescription} />
            ))}
          </div>
        </section>
      ))}

      {/* All-Time */}
      <h2 style={{ margin: "12px 0 0 0" }}>All-Time</h2>
      {sections.allTimeOrder.map((k) => (
        <section key={k} className="sf-card" style={{ borderRadius: 14 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{k}</h3>
            <span className="hint" style={{ fontSize: 13, fontWeight: 600 }}>
              {sections.alltime.get(k)?.length || 0} {showLocked ? "shown" : "unlocked"}
            </span>
          </header>
          <div className="ach-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {(sections.alltime.get(k) || []).map((a) => (
              <AchCard key={a.id} a={a} buff={a.__buff} perkDescription={a.__perkDescription} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
