import express from "express";
import 'dotenv/config';

// Lazy init admin to avoid requiring credentials in all environments
let admin = null;
let firestore = null;
let auth = null;
function ensureAdmin() {
  if (firestore) return firestore;
  // Require explicit credentials: either FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS
  const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!svcRaw && !hasADC) {
    return null;
  }
  try {
    // eslint-disable-next-line
    admin = require('firebase-admin');
  } catch (e) {
    return null;
  }
  try {
    if (!admin.apps?.length) {
      if (svcRaw) {
        const svc = JSON.parse(svcRaw);
        admin.initializeApp({ credential: admin.credential.cert(svc) });
      } else {
        admin.initializeApp(); // relies on GOOGLE_APPLICATION_CREDENTIALS
      }
    }
    firestore = admin.firestore();
    auth = admin.auth();
    return firestore;
  } catch (e) {
    return null;
  }
}

function sanitizeHandle(raw) {
  const s = String(raw || '').trim();
  return s.replace(/[^a-zA-Z0-9_]/g, '');
}
function validateHandle(raw) {
  const s = sanitizeHandle(raw);
  if (s.length < 3 || s.length > 20) return { ok:false, reason:'length' };
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return { ok:false, reason:'format' };
  return { ok:true, value:s };
}

const router = express.Router();
router.use(express.json({ limit: '1mb' }));

async function requireAuth(req, res, next) {
  const db = ensureAdmin();
  if (!db || !auth) return res.status(503).json({ error: 'admin_unavailable' });
  try {
    const hdr = String(req.get('authorization') || '').trim();
    if (!hdr.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'unauthorized' });
    const token = hdr.slice(7).trim();
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized', details: 'token_invalid' });
  }
}

router.get('/api/social/is-available', async (req, res) => {
  const db = ensureAdmin();
  if (!db) return res.status(503).json({ error: 'admin_unavailable' });
  try {
    const q = String(req.query.handle || '').trim();
    const clean = sanitizeHandle(q);
    if (!clean) return res.status(400).json({ error:'invalid' });
    const lower = clean.toLowerCase();
    const snap = await db.collection('handles').doc(lower).get();
    return res.json({ available: !snap.exists, owner: snap.exists ? (snap.data()?.uid || null) : null });
  } catch (e) {
    return res.status(500).json({ error:'lookup_failed', details: String(e) });
  }
});

router.post('/api/social/claim-handle', requireAuth, async (req, res) => {
  const db = ensureAdmin();
  if (!db) return res.status(503).json({ error: 'admin_unavailable' });
  try {
    const { handle } = req.body || {};
    const uid = req.user?.uid;
    if (!uid || !handle) return res.status(400).json({ error:'uid_and_handle_required' });
    const v = validateHandle(handle);
    if (!v.ok) return res.status(400).json({ error: v.reason });
    const original = v.value;
    const lower = original.toLowerCase();

    await db.runTransaction(async (tx) => {
      const hRef = db.collection('handles').doc(lower);
      const pRef = db.collection('profiles').doc(uid);

      const hSnap = await tx.get(hRef);
      if (hSnap.exists && hSnap.data()?.uid !== uid) {
        throw new Error('taken');
      }

      const pSnap = await tx.get(pRef);
      const oldLower = (pSnap.exists ? (pSnap.data()?.handleLower || '') : '').toString();

      tx.set(hRef, { uid, original, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(pRef, { handle: original, handleLower: lower, updatedAt: Date.now() }, { merge: true });

      if (oldLower && oldLower !== lower) {
        const oldRef = db.collection('handles').doc(oldLower);
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists && oldSnap.data()?.uid === uid) {
          tx.delete(oldRef);
        }
      }
    });

    return res.json({ ok:true, handle: original, lower });
  } catch (e) {
    if (String(e.message || e).includes('taken')) return res.status(409).json({ error:'taken' });
    return res.status(500).json({ error:'claim_failed', details: String(e) });
  }
});

export default router;
