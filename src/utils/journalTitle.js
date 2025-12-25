// src/utils/journalTitle.js
import { askAI } from "./ai.js";

function cleanTitle(raw) {
  try {
    let t = String(raw || "").trim();
    // strip quotes and emojis and excessive punctuation
    t = t.replace(/["'“”‘’]+/g, "");
    t = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
    t = t.replace(/\s{2,}/g, " ").trim();
    if (t.length > 60) t = t.slice(0, 60).trim();
    return t;
  } catch { return String(raw || "").trim(); }
}

export function fallbackTitleFrom(text) {
  try {
    const s = String(text || "").trim();
    if (!s) return "Journal entry";
    const firstSentence = s.split(/(?<=[.!؟?])\s+/)[0] || s.slice(0, 60);
    const clipped = firstSentence.length > 60 ? firstSentence.slice(0, 60) : firstSentence;
    return cleanTitle(clipped);
  } catch {
    return "Journal entry";
  }
}

export async function generateJournalTitle(text, opts = {}) {
  const body = (text || "").toString().trim();
  if (body.length < 12) return fallbackTitleFrom(body);

  const messages = [
    { role: "system", content: "You create short, evocative, epic/literary titles. 4–8 words, no emojis or quotes, no trailing punctuation." },
    { role: "user", content: `Write an epic/literary title for this journal content. 4–8 words, no emojis or quotes.\n---\n${body}` },
  ];
  try {
    const out = await askAI({ model: opts?.model, messages, temperature: 0.8 });
    const cleaned = cleanTitle(out);
    return cleaned || fallbackTitleFrom(body);
  } catch (e) {
    return fallbackTitleFrom(body);
  }
}

