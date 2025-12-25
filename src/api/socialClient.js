// src/api/socialClient.js
import { sanitizeHandle, validateHandle, isAvailable as isAvailableDirect, claimHandle as claimHandleDirect } from "./handles.js";

const BASE = "/api/social";

export function sanitize(h){ return sanitizeHandle(h); }
export function validate(h){ return validateHandle(h); }

export async function isAvailable(handle){
  const clean = sanitizeHandle(handle);
  if (!clean) return { available: false, reason: 'empty' };
  try {
    const r = await fetch(`${BASE}/is-available?handle=${encodeURIComponent(clean)}`);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    // fallback to client-side direct check
    return await isAvailableDirect(clean);
  }
}

export async function claimHandle(uid, handle){
  const clean = sanitizeHandle(handle);
  try {
    const r = await fetch(`${BASE}/claim-handle`, {
      method: 'POST', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ uid, handle: clean }),
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>null);
      const msg = j?.error || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return await r.json();
  } catch (e) {
    // fallback to client direct (non-atomic)
    return await claimHandleDirect(uid, clean);
  }
}

export async function getCurrentHandle(uid){
  // no server endpoint needed; read profile via handles.js helper fallback
  try {
    const mod = await import('./handles.js');
    return mod.getCurrentHandle(uid);
  } catch {
    return null;
  }
}

export async function fetchGlobalLeaderboards(uids){
  try{
    const qs = uids && uids.length ? `?uids=${encodeURIComponent(uids.join(','))}` : '';
    const r = await fetch(`/api/social/leaderboards/global${qs}`);
    if(!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch (e) {
    return { topLevel: [], topDailyGrowth: [], error: String(e) };
  }
}
