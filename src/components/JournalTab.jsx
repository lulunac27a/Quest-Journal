import React, { useEffect, useMemo, useRef, useState } from "react";
import { todayStr } from "../core/challenges.js";
import { generateSketch } from "../utils/ai.js";
import { loadEntry, saveEntry, listRecent, getImageURL, saveImageDataURL } from "../utils/journalStore.js";
import { buildSketchPrompt } from "../utils/sketchPrompt.js";
import { generateJournalTitle } from "../utils/journalTitle.js";

const MAX_CHARS = 1200;

function ymd(dateISO) { return (dateISO || todayStr()); }
function addDays(iso, delta) {
  const d = new Date(iso || new Date().toISOString());
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}
function idOf(iso) { return (iso || "").slice(0,10).replaceAll("-",""); } // yyyymmdd

export default function JournalTab() {
  const [dateISO, setDateISO] = useState(new Date().toISOString());
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [titleSrc, setTitleSrc] = useState("ai"); // 'user' | 'ai'
  const [status, setStatus] = useState("idle"); // idle | saving | generating | error
  const [titleBusy, setTitleBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState(null);
  const [meta, setMeta] = useState({ provider:null, model:null, seed:null });
  const [recentsTick, setRecentsTick] = useState(0);

  const curId = useMemo(()=> idOf(dateISO), [dateISO]);
  const charsLeft = MAX_CHARS - (text?.length || 0);
  const overLimit = charsLeft < 0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const e = loadEntry(curId);
      if (!mounted) return;
      setText(e?.text || "");
      setTitle(e?.title || "");
      setTitleSrc(e?.titleSource || (e?.title ? 'user' : 'ai'));
      setMeta(e?.sketch?.meta || {});
      const u = await getImageURL(curId).catch(()=>null);
      if (!mounted) return;
      setImgUrl(u);
    })();
    return () => { mounted = false; };
  }, [curId]);

  // Refresh recent list when journals update
  useEffect(() => {
    const onUpdate = () => setRecentsTick((x) => x + 1);
    try { window.addEventListener('qj:journal-updated', onUpdate); } catch {}
    return () => { try { window.removeEventListener('qj:journal-updated', onUpdate); } catch {} };
  }, []);

  async function doSave() {
    if (overLimit) return;
    setStatus("saving");
    const now = new Date().toISOString();
    const entry = {
      id: curId,
      dateISO: ymd(dateISO),
      text: (text || "").slice(0, MAX_CHARS),
      title: (title || "").slice(0, 80),
      titleSource: titleSrc,
      sketch: {
        status: imgUrl ? "ready" : "none",
        meta,
      },
      meta: { createdAt: loadEntry(curId)?.meta?.createdAt || now, updatedAt: now },
    };
    saveEntry(entry);
    setStatus("idle");
    try { window.dispatchEvent(new Event('qj:journal-updated')); } catch {}
    // Auto-generate a title when empty or AI-managed
    const needsAI = !title?.trim() || titleSrc === 'ai';
    if (needsAI) {
      try {
        setTitleBusy(true);
        const t = await generateJournalTitle(text);
        const now2 = new Date().toISOString();
        const latest = loadEntry(curId) || entry;
        const updated = { ...latest, title: t, titleSource: 'ai', meta: { ...(latest.meta||{}), updatedAt: now2 } };
        saveEntry(updated);
        setTitle(t);
        setTitleSrc('ai');
        try { window.dispatchEvent(new Event('qj:journal-updated')); } catch {}
      } finally {
        setTitleBusy(false);
      }
    }
  }

  async function doGenerate(regen=false) {
    try {
      if ((text || "").trim().length < 12) {
        alert("Write a few lines first (≥12 chars).");
        return;
      }
      setStatus("generating");
      const prompt = await buildSketchPrompt(text);
      const resp = await generateSketch(prompt, {
        size: "512x512",
        negative_prompt: "text, letters, words, typography, watermark, logos, identifiable faces, photo-real face",
      });
      await saveImageDataURL(curId, resp.image);
      setImgUrl(resp.image);
      const now = new Date().toISOString();
      const existing = loadEntry(curId) || { id: curId, dateISO: ymd(dateISO), text: text.slice(0,MAX_CHARS) };
      const entry = {
        ...existing,
        text: (regen ? existing.text : text).slice(0, MAX_CHARS),
        title: (title || existing.title || '').slice(0,80),
        titleSource: titleSrc || existing.titleSource || 'ai',
        sketch: { status: "ready", meta: { provider: resp.provider, model: resp.model, seed: resp.seed } },
        meta: { createdAt: existing?.meta?.createdAt || now, updatedAt: now },
      };
      saveEntry(entry);
      setMeta(entry.sketch.meta);
      setStatus("idle");
      try { window.dispatchEvent(new Event('qj:journal-updated')); } catch {}
    } catch (e) {
      console.error(e);
      setStatus("error");
      alert("Image generation failed: " + (e.message || e));
      setStatus("idle");
    }
  }

  async function download() {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `journal_${curId}.jpg`;
    a.click();
  }

  const recent = useMemo(()=> listRecent(10), [dateISO, recentsTick]);

  return (
    <div className="card" style={{ display:"grid", gap:12 }}>
      {/* Header */}
      <div className="row-sb" style={{ alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <button className="btn" onClick={()=>setDateISO(addDays(dateISO, -1))}>◀︎</button>
          <h3 style={{ margin:0 }}>{(ymd(dateISO)).slice(0,10)}</h3>
          <button className="btn" onClick={()=>setDateISO(addDays(dateISO, +1))}>▶︎</button>
        </div>
        <div className="hint" style={{ minWidth:0, whiteSpace:"normal" }}>One page a night • Max {MAX_CHARS} chars</div>
      </div>

      {/* Responsive columns */}
      <div className="journal-grid">
        {/* Left: editor */}
        <div className="sf-card" style={{ display:"grid", gap:8, padding:12 }}>
          <div className="row-sb" style={{ alignItems:'center', gap:8 }}>
            <input
              value={title}
              placeholder="Name your day..."
              onChange={(e)=> { setTitle(e.target.value); setTitleSrc('user'); }}
              style={{ flex:1, padding:"8px 10px", borderRadius:10, border:"1px solid var(--border)", background:"var(--bg, var(--card))" }}
            />
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button className="btn" onClick={async()=>{
                try { setTitleBusy(true); const t = await generateJournalTitle(text); setTitle(t); setTitleSrc('ai'); } finally { setTitleBusy(false); }
              }} disabled={titleBusy || (text||'').trim().length<12}>
                {titleBusy ? 'Titling…' : 'AI title'}
              </button>
              <span className={`hint ${overLimit ? "error":""}`}>{Math.max(0, charsLeft)} / {MAX_CHARS}</span>
            </div>
          </div>
          <textarea
            value={text}
            placeholder="Write about your day like a wandering mercenary..."
            onChange={(e)=> setText(e.target.value)}
            /* ارتفاع تطبیقی به‌جای rows ثابت */
            style={{ minHeight: "clamp(200px, 40vh, 420px)" }}
          />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <button className="btn" onClick={doSave} disabled={overLimit || status==="saving"}>
              {status==="saving" ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={()=>doGenerate(false)} disabled={overLimit || status==="generating"}>
              {status==="generating" ? "Generating…" : "Generate sketch"}
            </button>
            <button className="btn" onClick={()=>doGenerate(true)} disabled={!imgUrl || status==="generating"}>Regenerate</button>
          </div>
        </div>

        {/* Right: sketch pane */}
        <div className="sf-card" style={{ padding:12, display:"grid", gap:8 }}>
          <b>Sketch</b>
          <div style={{
            border:"1px dashed var(--border)",
            borderRadius:12,
            aspectRatio:"1 / 1",        /* مربعِ قابل‌انعطاف */
            width:"100%",
            display:"grid",
            placeItems:"center",
            background:"var(--muted)"
          }}>
            {imgUrl ? (
              <img
                src={imgUrl}
                alt="journal sketch"
                style={{ width:"100%", height:"100%", objectFit:"contain", borderRadius:12 }}
              />
            ) : (
              <div className="hint">No sketch yet — click “Generate sketch”.</div>
            )}
          </div>
          <div className="row-sb" style={{ gap:8, flexWrap:"wrap" }}>
            <span className="hint">Model: {meta?.model || "—"} {meta?.provider ? `• ${meta.provider}` : ""}</span>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={download} disabled={!imgUrl}>Download</button>
            </div>
          </div>
        </div>
      </div>

      {/* Archive strip */}
      <div className="sf-card" style={{ padding:12 }}>
        <b>Recent pages</b>
        <div style={{ display:"flex", gap:10, overflowX:"auto", marginTop:8, padding:"4px 2px", boxSizing:"border-box", overscrollBehaviorX:"contain" }}>
          {recent.length === 0 && <div className="hint">No entries yet.</div>}
          {recent.map(e => (
            <button
              key={e.id}
              className="btn"
              style={{ padding:0, borderRadius:12, overflow:"hidden", height:"auto", flex:"0 0 120px", minWidth:120 }}
              onClick={()=> setDateISO(new Date(e.dateISO).toISOString())}
              title={e.title || 'Journal entry'}
            >
              <div style={{ width:120, height:120, background:"var(--muted)", display:"grid", placeItems:"center", position:"relative" }}>
                {e.thumb ? (
                  <>
                    <img src={e.thumb} alt={e.id} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    <div
                      title={e.title || 'Journal entry'}
                      style={{ position:"absolute", left:0, right:0, bottom:0, padding:"6px 8px", fontSize:12, color:"#fff", textShadow:"0 1px 2px rgba(0,0,0,.6)", background:"linear-gradient( to top, rgba(0,0,0,.6), rgba(0,0,0,0) )", overflow:"hidden", textAlign:"center", lineHeight:1.25, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", whiteSpace:"normal", wordBreak:"break-word" }}>
                      {e.title || 'Journal entry'}
                    </div>
                  </>
                ) : (
                  <div style={{ padding:"8px 10px", textAlign:"center", lineHeight:1.25, fontSize:12, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", whiteSpace:"normal", wordBreak:"break-word", maxWidth:110 }}>
                    {e.title || 'Journal entry'}
                  </div>
                )}
              </div>
              <div className="mono" style={{ padding:"4px 8px" }}>
                {e.id.slice(0,4)}-{e.id.slice(4,6)}-{e.id.slice(6)}
              </div>
              {/* Only date below tile; no title */}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
