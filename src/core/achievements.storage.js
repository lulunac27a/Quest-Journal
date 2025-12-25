// src/core/achievements.storage.js
// ─────────────────────────────────────────────────────────────
// ذخیره و بازیابی اچیومنت‌ها از localStorage
// این فایل هیچ وابستگی به catalog یا logic نداره
// ─────────────────────────────────────────────────────────────

/**
 * شکل داده در localStorage:
 * { unlocked: [{ id, label, tier, type, icon, gainedAt, xpReward, description }], ... }
 */

import { getJSON as getJSONu, setJSON as setJSONu } from "./userLocal.js";
import { emitChange } from "../sync/repos.js";

export function loadAchievements() {
  try { return getJSONu("qj_ach_v2", {}) || {}; }
  catch { return {}; }
}

export function saveAchievements(ach) {
  try {
    setJSONu("qj_ach_v2", ach || {});
    try { emitChange(); } catch {}
  } catch {}
}

/**
 * همگام‌سازی داده‌های نمایش unlocked با جدیدترین کاتالوگ
 * (در صورت تغییر توضیحات یا آیکن در نسخه‌های بعد)
 */
export function reconcileAchievementsWithCatalog(ach, catalog) {
  try {
    const byId = {};
    (catalog || []).forEach(it => { if (it?.id) byId[it.id] = it; });

    const unlocked = Array.isArray(ach?.unlocked) ? ach.unlocked : [];
    const nextUnlocked = unlocked.map(u => {
      const fresh = byId[u?.id];
      if (!fresh) return u;
      return {
        ...u,
        label: fresh.label ?? u.label,
        icon: fresh.icon ?? u.icon,
        type: fresh.type ?? u.type,
        tier: fresh.tier ?? u.tier,
        description: fresh.description ?? u.description,
      };
    });

    return { ...(ach || {}), unlocked: nextUnlocked };
  } catch {
    return ach;
  }
}
