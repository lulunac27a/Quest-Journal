// src/components/TopAchievements.jsx
import React, { useMemo } from "react";
import { ACH_CATALOG } from "../core/achievements.js";

// Map catalog by id to ensure we show canonical icon/label like Achievements tab
const CATALOG_BY_ID = (() => {
  try {
    const map = {};
    (ACH_CATALOG || []).forEach((it) => { if (it && it.id) map[it.id] = it; });
    return map;
  } catch {
    return {};
  }
})();

export default function TopAchievements({ ach, limit = 10 }) {
  // Fallback icons by category/type (use escapes to avoid codepage issues)
  const SAFE_BY_TYPE = {
    productivity: "\uD83C\uDFC5", // 🏅
    social:       "\uD83E\uDD1D", // 🤝
    learning:     "\uD83D\uDCD8", // 📘
    health:       "\uD83D\uDC9A", // 💚
    strength:     "\uD83D\uDCAA", // 💪
    athletics:    "\uD83C\uDFC3", // 🏃
    trade:        "\uD83D\uDCB0", // 💰
    meta:         "\u2728",       // ✨
    daily:        "\uD83D\uDD25", // 🔥
    weekly:       "\uD83C\uDF89", // 🎉
    generic:      "\uD83C\uDFC5", // 🏅
  };

  const pickSafeIcon = (a) => {
    const raw = (CATALOG_BY_ID[a?.id]?.icon ?? a?.icon ?? "").toString();
    const looksBad = !raw || /\uFFFD/.test(raw) || /[\x00-\x1F\x7F]/.test(raw);
    if (!looksBad) return raw;
    const t = (a?.type || a?.family || a?.baseId || "generic").toString().toLowerCase();
    return SAFE_BY_TYPE[t] || SAFE_BY_TYPE.generic;
  };

  const top = useMemo(() => {
    if (!ach) return [];

    // Merge unlocked + ephemerals, pick best tier per family
    const source = [
      ...(Array.isArray(ach.unlocked) ? ach.unlocked : []),
      ...(Array.isArray(ach.ephemeralDaily) ? ach.ephemeralDaily : []),
      ...(Array.isArray(ach.ephemeralWeekly) ? ach.ephemeralWeekly : []),
    ];
    if (source.length === 0) return [];

    const bestPerFamily = new Map();
    for (const a of source) {
      const familyKey = (a.family || a.baseId || a.type || "").toLowerCase();
      const prev = bestPerFamily.get(familyKey);
      if (!prev) { bestPerFamily.set(familyKey, a); continue; }

      const prevTier = prev.tier || 0;
      const curTier = a.tier || 0;
      if (curTier > prevTier) {
        bestPerFamily.set(familyKey, a);
      } else if (curTier === prevTier) {
        const prevTime = new Date(prev.gainedAt || 0).getTime();
        const curTime  = new Date(a.gainedAt  || 0).getTime();
        if (curTime > prevTime) bestPerFamily.set(familyKey, a);
      }
    }

    const unique = [...bestPerFamily.values()];
    unique.sort((a, b) => {
      const ta = a.tier || 0, tb = b.tier || 0;
      if (tb !== ta) return tb - ta;
      const da = new Date(a.gainedAt || 0).getTime();
      const db = new Date(b.gainedAt || 0).getTime();
      return db - da;
    });

    // Prefer certain categories at the front
    const preferred = ["social", "learning", "health", "meta"];
    const isPref = (a) => preferred.includes((a.type || "").toLowerCase());
    const ordered = [
      ...unique.filter(isPref),
      ...unique.filter((a) => !isPref(a)),
    ];
    return ordered.slice(0, limit);
  }, [ach, limit]);

  if (top.length === 0) return null;

  return (
    <div className="top-achievements" style={{ columnGap: 10, rowGap: 14, marginTop: 10 }}>
      {top.map((a) => {
        const rawKey = (a.family || a.baseId || a.type || 'generic').toString();
        const safeKey = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'generic';
        return (
          <div
            key={a.id}
            className="ach-pill"
            data-ach-type={safeKey}
            title={`${(CATALOG_BY_ID[a?.id]?.label ?? a.label)}${a.tier ? ` (Tier ${a.tier})` : ''}`}
          >
            <span className="ach-pill-icon">{pickSafeIcon(a)}</span>
            <span className="ach-pill-label">{CATALOG_BY_ID[a?.id]?.label ?? a.label}</span>
            {a.tier ? (<span className="ach-pill-tier">Tier {a.tier}</span>) : null}
          </div>
        );
      })}
    </div>
  );
}

