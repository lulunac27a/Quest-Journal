// Robust ID generator used across the app.
// Prefer crypto.randomUUID when available; fallback to a safe random.
export const uid = () => {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {}
  try {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const PRAISES = [
  "Great job!","Nice!","Crushed it!","You rock!","Boom!","On fire!","Well done!",
  "Legendary!","Epic move!","Bravo!","Hot streak!","Shine!","Clean hit!","Clutch!"
];

// Visual celebration symbols shown at the top of the page
// Keep these to simple, widely-supported emoji (escaped for safety)
export const SYMBOLS = [
  "\uD83C\uDF89", // 🎉
  "\u2728",       // ✨
  "\uD83C\uDFC5", // 🏅
  "\uD83D\uDD25", // 🔥
  "\uD83D\uDCAA", // 💪
  "\uD83E\uDDE0", // 🧠
  "\u26A1",       // ⚡
  "\uD83C\uDF1F", // 🌟
  "\uD83E\uDD84", // 🦄
  "\uD83D\uDE80"  // 🚀
];
