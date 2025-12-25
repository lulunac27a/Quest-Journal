// src/core/dates.js
// Deadline utilities used by App.jsx

const msPer = {
  min: 60_000,
  h:   3_600_000,
  d:   86_400_000,
};

function safeInt(v) {
  const n = parseInt(v || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute ISO deadline from relative or absolute inputs.
 * - absoluteDue: ISO string or null (from date/time pickers)
 * - deadlineAmt: number-like
 * - deadlineUnit: "min" | "h" | "d"
 * - now: timestamp (optional; defaults to Date.now())
 */
export function computeDeadlineISO({ absoluteDue, deadlineAmt, deadlineUnit, now = Date.now() }) {
  if (absoluteDue) return absoluteDue;
  const amt = safeInt(deadlineAmt);
  if (!amt) return null;
  const mult = msPer[deadlineUnit] ?? msPer.h;
  return new Date(now + amt * mult).toISOString();
}

/**
 * Next deadline for recurring tasks (daily/weekly/monthly)
 */
export function nextDeadline(task) {
  if (!task?.recur || task.recur === "none") return null;
  const base = task.deadline ? new Date(task.deadline) : new Date();
  const d = new Date(base);
  const baseH = d.getHours();
  const baseM = d.getMinutes();
  const setTime = (dt) => dt.setHours(baseH, baseM, 0, 0);
  if (task.recur === "daily") {
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (task.recur === "weekly") {
    const days = Array.isArray(task.recurWeeklyDays)
      ? Array.from(new Set(task.recurWeeklyDays.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)))
      : [];
    const targetDays = days.length ? days : [d.getDay()];
    let best = null;
    targetDays.forEach((dow) => {
      const cand = new Date(d);
      const curDow = cand.getDay();
      let delta = (dow - curDow + 7) % 7;
      cand.setDate(cand.getDate() + delta);
      setTime(cand);
      if (cand <= d) cand.setDate(cand.getDate() + 7);
      if (!best || cand < best) best = cand;
    });
    if (!best) { d.setDate(d.getDate() + 7); return d.toISOString(); }
    return best.toISOString();
  }
  if (task.recur === "monthly") {
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  // Custom repeat: day-of-month numbers OR legacy array of { dow: 0..6, time: "HH:MM" }
  if (task.recur === "custom" && Array.isArray(task.recurCustom) && task.recurCustom.length > 0) {
    const dayNums = Array.from(new Set(task.recurCustom.map((v) => typeof v === "number" ? v : Number.isFinite(v?.day) ? v.day : NaN).filter((n) => Number.isFinite(n) && n >= 1 && n <= 31))).sort((a, b) => a - b);
    if (dayNums.length > 0) {
      let bestDay = null;
      for (let monthOffset = 0; monthOffset < 14; monthOffset++) {
        const pivot = new Date(d);
        pivot.setMonth(pivot.getMonth() + monthOffset, 1);
        const dim = new Date(pivot.getFullYear(), pivot.getMonth() + 1, 0).getDate();
        for (const day of dayNums) {
          if (day > dim) continue;
          const cand = new Date(pivot);
          cand.setDate(day);
          setTime(cand);
          if (cand <= d) continue;
          if (!bestDay || cand < bestDay) bestDay = cand;
        }
        if (bestDay) break;
      }
      if (bestDay) return bestDay.toISOString();
    }
    const toHM = (timeStr) => {
      if (typeof timeStr !== 'string') return { h: 0, m: 0 };
      const [H, M] = timeStr.split(":").map(x => parseInt(x || "0", 10));
      return { h: Math.max(0, Math.min(23, H || 0)), m: Math.max(0, Math.min(59, M || 0)) };
    };
    const nextFor = (baseDate, dow, timeStr) => {
      const { h, m } = toHM(timeStr);
      const b = new Date(baseDate);
      const candidate = new Date(b);
      // find delta days to desired day of week [0..6], using Sunday=0
      const curDow = candidate.getDay();
      let delta = (dow - curDow + 7) % 7;
      candidate.setDate(candidate.getDate() + delta);
      candidate.setHours(h, m, 0, 0);
      // if not strictly after base, bump by a week
      if (candidate <= b) {
        candidate.setDate(candidate.getDate() + 7);
      }
      return candidate;
    };
    let best = null;
    try {
      for (const ent of task.recurCustom) {
        if (!ent) continue;
        const dow = Number(ent.dow);
        if (!Number.isFinite(dow)) continue;
        const cand = nextFor(d, dow, ent.time || "00:00");
        if (!best || cand < best) best = cand;
      }
    } catch {}
    return best ? best.toISOString() : null;
  }

  return d.toISOString();
}
