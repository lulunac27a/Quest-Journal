// src/utils/ai.js
const BYOK_KEY = "qj_ai_byok_v1";

function readBYOK() {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.apiKey || !v?.baseUrl) return null;
    return v; // { enabled, apiKey, baseUrl, model }
  } catch {
    return null;
  }
}

function isBYOKEnabled() {
  const cfg = readBYOK();
  return !!(cfg && cfg.enabled && cfg.apiKey && cfg.baseUrl);
}

async function chatViaBYOK({ model, messages, temperature, reasoning }) {
  const cfg = readBYOK();
  const base = String(cfg.baseUrl || "").replace(/\/$/, "");
  const endpoint = `${base}/chat/completions`;
  const body = { model: model || cfg.model || "openrouter/auto", messages, temperature, reasoning };
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || j?.error || `AI ${r.status}`);
  const content = j?.choices?.[0]?.message?.content ?? j?.content ?? j?.choices?.[0]?.delta?.content ?? "";
  return String(content).trim();
}

async function chatViaProxyUrl({ model, messages, temperature, reasoning }) {
  const API = import.meta.env?.VITE_AI_PROXY_URL;
  if (!API) throw new Error("VITE_AI_PROXY_URL not set");
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, reasoning, stream: false }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || j?.error || `AI ${r.status}`);
  const content = j?.choices?.[0]?.message?.content ?? j?.content ?? "";
  return String(content).trim();
}

async function chatViaLocalProxy({ model, messages, temperature, reasoning }) {
  const r = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, reasoning }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `AI ${r.status}`);
  const content = j?.choices?.[0]?.message?.content ?? j?.content ?? "";
  return String(content).trim();
}

// Prefer BYOK direct -> Cloudflare Worker -> local /api fallback
export async function askAI({ model, messages, temperature = 0.8, reasoning } = {}) {
  if (isBYOKEnabled()) return chatViaBYOK({ model, messages, temperature, reasoning });
  if (import.meta.env?.VITE_AI_PROXY_URL) return chatViaProxyUrl({ model, messages, temperature, reasoning });
  return chatViaLocalProxy({ model, messages, temperature, reasoning });
}

// --- Streaming helpers ---
function parseAndEmitSSEChunk(buffer, onToken) {
  const text = buffer;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        // OpenAI-like delta
        const delta = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? j?.content ?? "";
        if (typeof delta === "string" && delta) onToken(delta);
        // OpenRouter sometimes streams as {response: {output_text}}
        const out = j?.response?.output_text;
        if (typeof out === "string" && out) onToken(out);
      } catch {
        // Some providers stream plain text blocks
        if (data) onToken(data);
      }
    }
  }
}

async function readSSE(response, onToken) {
  const reader = response.body?.getReader?.();
  if (!reader) return;
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    // Process complete event blocks split by double newlines
    const parts = pending.split(/\n\n/);
    pending = parts.pop() || "";
    for (const part of parts) parseAndEmitSSEChunk(part, onToken);
  }
  if (pending) parseAndEmitSSEChunk(pending, onToken);
}

async function chatViaBYOKStream({ model, messages, temperature, reasoning, onToken }) {
  const cfg = readBYOK();
  const base = String(cfg.baseUrl || "").replace(/\/$/, "");
  const endpoint = `${base}/chat/completions`;
  const body = { model: model || cfg.model || "openrouter/auto", messages, temperature, reasoning, stream: true };
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "text/event-stream", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  await readSSE(r, onToken);
}

async function chatViaProxyUrlStream({ model, messages, temperature, reasoning, onToken }) {
  const API = import.meta.env?.VITE_AI_PROXY_URL;
  if (!API) throw new Error("VITE_AI_PROXY_URL not set");
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, messages, temperature, reasoning, stream: true }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  await readSSE(r, onToken);
}

async function chatViaLocalProxyStream({ model, messages, temperature, reasoning, onToken }) {
  const url = "/api/ai/chat?stream=1";
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, messages, temperature, reasoning, stream: true }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  await readSSE(r, onToken);
}

// Streamed variant: emits tokens via onToken callback and returns final text
export async function askAIStream({ model, messages, temperature = 0.8, reasoning, onToken } = {}) {
  let acc = "";
  const emit = (t) => { acc += t; if (onToken) onToken(t, acc); };
  if (isBYOKEnabled()) {
    await chatViaBYOKStream({ model, messages, temperature, reasoning, onToken: emit });
  } else if (import.meta.env?.VITE_AI_PROXY_URL) {
    await chatViaProxyUrlStream({ model, messages, temperature, reasoning, onToken: emit });
  } else {
    await chatViaLocalProxyStream({ model, messages, temperature, reasoning, onToken: emit });
  }
  return acc.trim();
}

import { loadProfile } from "../core/profile.js";

function buildStoryMessages(mode, { title, notes, heroName }) {
  const hero = heroName ? `\nHero: ${heroName}` : "";
  const common = `Task title: "${title}"\nNotes: ${notes || "-"}${hero}`;
  switch ((mode || "epic").toLowerCase()) {
    case "explanatory":
    case "planner":
    case "plan": {
      const system = "You are an expert planning assistant. Write a concise, practical plan (60-80 words) to execute the user's task. Use clear, simple language. Break the work into small steps and call out likely blockers and how to remove them. Avoid fluff and greetings.";
      const user = `${common}\nDeliverable: One short paragraph that lists small steps and mentions key obstacles and how to unblock them.`;
      return { system, user, temperature: 0.6 };
    }
    case "encouraging":
    case "cheer":
    case "motivate": {
      const system = "You are a supportive coach. Write a short, upbeat encouragement message (60-80 words) tailored to the user's task. Be specific, actionable, and warm; include 1-2 concrete suggestions to get started now. Keep it human and sincere.";
      const user = `${common}\nStyle: friendly, specific, energizing. Include a 'first step' suggestion.`;
      return { system, user, temperature: 0.9 };
    }
    case "literary":
    case "poetic":
    case "prose": {
      const system = "You are a literary stylist. Describe the user's task in a vivid, poetic yet clear prose vignette (60-80 words). Keep it elegant and inspiring, not archaic. No rhymes or bullet points. Prefer sensory imagery and metaphors while staying faithful to the task.";
      const user = `${common}\nTone: elegant modern prose, uplifting, imagistic; avoid purple prose.`;
      return { system, user, temperature: 0.85 };
    }
    case "epic":
    default: {
      const system = "You are a Modern bard AI. Write a short, punchy, heroic vignette (60-80 words) about the user's quest. No bullet points. If a hero name is provided, address or reference them naturally.";
      const user = `${common}\nTone: Modern epic fantasy, adventurous, motivational, no archaic diction.`;
      return { system, user, temperature: 0.9 };
    }
  }
}

export async function storyForTask(mode, title, notes = "", opts = {}) {
  const profile = (() => { try { return loadProfile() || {}; } catch { return {}; } })();
  const heroName = (opts?.authorName || profile?.name || "").toString().trim();
  const spec = buildStoryMessages(mode, { title, notes, heroName });
  const payload = {
    model: opts?.model,
    messages: [
      { role: "system", content: spec.system },
      { role: "user", content: spec.user },
    ],
    temperature: spec.temperature,
  };
  if (opts?.stream) {
    return await askAIStream({ ...payload, onToken: opts.onToken });
  }
  return await askAI(payload);
}

// Backward compatibility: keep epicifyTask using the new engine
export async function epicifyTask(title, notes = "", opts = {}) {
  return storyForTask("epic", title, notes, opts);
}

// Image: Prefer BYOK direct; otherwise fall back to local proxy (quota, formats)
export async function generateSketch(prompt, { model, size = "512x512", seed, negative_prompt } = {}) {
  if (isBYOKEnabled()) {
    const cfg = readBYOK();
    const base = String(cfg.baseUrl || "").replace(/\/$/, "");
    const endpoint = `${base}/images/generate`;
    const body = { model: model || cfg.model || "openrouter/auto", prompt, size, n: 1, ...(seed?{seed}:{}) , ...(negative_prompt?{negative_prompt}:{}) };
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error?.message || j?.error || `Image ${r.status}`);
    // normalize typical OpenRouter image formats
    let img = null;
    if (Array.isArray(j?.output) && j.output[0]) {
      const v = j.output[0];
      img = typeof v === "string" ? v : null;
    }
    if (!img && Array.isArray(j?.data) && j.data[0]?.b64_json) {
      img = `data:image/png;base64,${j.data[0].b64_json}`;
    }
    if (!img) throw new Error("No image returned");
    return { image: img.startsWith("data:") ? img : `data:image/png;base64,${img}`, provider: "openrouter", model: body.model };
  }

  // Fallback to local dev proxy
  const r = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, model, size, seed, negative_prompt }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `Image ${r.status}`);
  return j; // { image, provider, model, ... }
}
