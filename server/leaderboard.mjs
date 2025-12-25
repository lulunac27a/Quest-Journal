import express from "express";

let admin = null;
let firestore = null;
function ensureAdmin() {
  if (firestore) return firestore;
  try { admin = require('firebase-admin'); } catch { return null; }
  try {
    if (!admin.apps?.length) admin.initializeApp();
    firestore = admin.firestore();
    return firestore;
  } catch { return null; }
}

// Level curve copied to server (keep in sync with src/core/gamify.js)
const BASE_XP = 1000;
const GROWTH = 1.10;
function levelFromXP(xp) {
  if (!xp || xp <= 0) return 1;
  const val = (xp * (GROWTH - 1)) / BASE_XP + 1;
  const l = Math.floor(Math.log(Math.max(val, 1)) / Math.log(GROWTH)) + 1;
  return Math.max(1, l);
}

function todayKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

async function fetchAllProfiles(db) {
  const col = await db.collection('profiles').get();
  const out = new Map();
  col.forEach(doc => {
    const d = doc.data() || {};
    out.set(doc.id, { uid: doc.id, handle: d.handle || null, name: d.name || null });
  });
  return out; // Map uid -> profile
}

async function fetchAllUserIds(db) {
  const usersSnap = await db.collection('users').get();
  const ids = new Set();
  usersSnap.forEach(doc => ids.add(doc.id));
  return Array.from(ids);
}

async function fetchUserXP(db, uid) {
  try {
    const ref = db.collection('users').doc(uid).collection('app').doc('state');
    const snap = await ref.get();
    const xp = snap.exists ? (parseInt(snap.data()?.xp || 0, 10) || 0) : 0;
    return xp;
  } catch {
    return 0;
  }
}

async function rebuildLeaderboards(db) {
  const profMap = await fetchAllProfiles(db);
  const uids = new Set([ ...await fetchAllUserIds(db), ...profMap.keys() ]);
  const rows = [];
  for (const uid of uids) {
    const p = profMap.get(uid) || { uid, handle: null, name: null };
    const xp = await fetchUserXP(db, uid);
    const level = levelFromXP(xp);
    rows.push({ uid, handle: p.handle, name: p.name, xp, level });
  }
  rows.sort((a,b) => (b.level - a.level) || (b.xp - a.xp));
  const topLevel = rows.slice(0, 100);

  // baseline
  const bk = todayKeyUTC();
  const baseRef = db.collection('leaderboards').doc('global').collection('snapshots').doc(bk);
  const baseSnap = await baseRef.get();
  let baseMap = {};
  if (!baseSnap.exists) {
    // build baseline for today
    baseMap = Object.fromEntries(rows.map(r => [r.uid, r.xp]));
    await baseRef.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), xpByUid: baseMap });
  } else {
    baseMap = baseSnap.data()?.xpByUid || {};
  }

  const growthRows = rows.map(r => ({ ...r, growth: r.xp - (parseInt(baseMap[r.uid] || 0, 10) || 0) }));
  growthRows.sort((a, b) => (b.growth - a.growth) || (b.xp - a.xp));
  const topDailyGrowth = growthRows.slice(0, 100);

  // write snapshots
  const root = db.collection('leaderboards').doc('global');
  await root.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await root.collection('boards').doc('topLevel').set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), list: topLevel }, { merge: false });
  await root.collection('boards').doc('topDailyGrowth').set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), list: topDailyGrowth }, { merge: false });
}

async function readGlobal(db) {
  const root = db.collection('leaderboards').doc('global');
  const tl = await root.collection('boards').doc('topLevel').get();
  const dg = await root.collection('boards').doc('topDailyGrowth').get();
  return {
    topLevel: tl.exists ? tl.data()?.list || [] : [],
    topDailyGrowth: dg.exists ? dg.data()?.list || [] : [],
  };
}

const router = express.Router();
router.get('/api/social/leaderboards/global', async (req, res) => {
  const db = ensureAdmin();
  if (!db) return res.status(503).json({ error: 'admin_unavailable' });
  try {
    const data = await readGlobal(db);
    // Optionally include baseline xp for requested uids for client-side growth of friends
    const uidsParam = String(req.query.uids || '').trim();
    let baseline = undefined;
    if (uidsParam) {
      const reqUids = new Set(uidsParam.split(',').map(s => s.trim()).filter(Boolean));
      const bk = todayKeyUTC();
      const baseRef = db.collection('leaderboards').doc('global').collection('snapshots').doc(bk);
      const baseSnap = await baseRef.get();
      const map = baseSnap.exists ? (baseSnap.data()?.xpByUid || {}) : {};
      baseline = Object.fromEntries(Array.from(reqUids).map(u => [u, parseInt(map[u] || 0, 10) || 0]));
    }
    return res.json({ ...data, ...(baseline ? { baseline } : {}) });
  } catch (e) {
    return res.status(500).json({ error: 'read_failed', details: String(e) });
  }
});

router.post('/api/social/leaderboards/rebuild', async (req, res) => {
  const db = ensureAdmin();
  if (!db) return res.status(503).json({ error: 'admin_unavailable' });
  // Simple admin guard via shared secret header
  try {
    const secret = process.env.ADMIN_SECRET || '';
    if (!secret) return res.status(503).json({ error: 'admin_disabled' });
    const hdr = String(req.get('x-admin-secret') || '');
    if (hdr !== secret) return res.status(401).json({ error: 'unauthorized' });

    await rebuildLeaderboards(db);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'rebuild_failed', details: String(e) });
  }
});

export default router;

// Optional auto-rebuild every 15 minutes (set LEADERBOARD_AUTO=1)
try {
  if (process.env.LEADERBOARD_AUTO === '1') {
    const db = ensureAdmin();
    if (db) {
      setInterval(() => { rebuildLeaderboards(db).catch(()=>{}); }, 15 * 60 * 1000);
    }
  }
} catch {}
