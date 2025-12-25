// Lightweight XP gain event bus for UI feedback (HUD pulses, micro overlays, sounds).
// Keeps the main components lean by isolating publish/subscribe logic here.

import { useEffect, useState } from "react";

const subs = new Set();

export function subscribeXpGains(fn) {
  if (typeof fn !== "function") return () => {};
  subs.add(fn);
  return () => subs.delete(fn);
}

export function emitXpGainEvent(evt) {
  if (!evt) return null;
  const payload = {
    id: evt.id || `xp:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    ts: evt.ts || Date.now(),
    ...evt,
  };
  subs.forEach((fn) => {
    try { fn(payload); } catch { /* ignore listener errors */ }
  });
  return payload;
}

// Convenience hook for components that only need the latest event (e.g., HUD pulse).
export function useLatestXpGain() {
  const [ev, setEv] = useState(null);
  useEffect(() => subscribeXpGains(setEv), []);
  return ev;
}

// Convenience hook for side-effect listeners.
export function useXpGainListener(handler) {
  useEffect(() => subscribeXpGains(handler), [handler]);
}
