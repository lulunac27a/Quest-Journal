// src/core/templates.js
// Local storage for Inbox template library and quick notes

import { getJSON, setJSON } from "./userLocal.js";

const KEYS = {
  TEMPLATES: "qj_templates_v1",
  INBOX_NOTES: "qj_inbox_notes_v1",
};

export function loadTemplates() {
  const arr = getJSON(KEYS.TEMPLATES, []);
  return Array.isArray(arr) ? arr : [];
}
export function saveTemplates(arr) {
  setJSON(KEYS.TEMPLATES, Array.isArray(arr) ? arr : []);
}

export function loadInboxNotes() {
  const arr = getJSON(KEYS.INBOX_NOTES, []);
  return Array.isArray(arr) ? arr : [];
}
export function saveInboxNotes(arr) {
  setJSON(KEYS.INBOX_NOTES, Array.isArray(arr) ? arr : []);
}

