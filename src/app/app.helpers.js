import { QUEST_TYPES } from "../core/constants.js";
import { namespacedKey as nsKey } from "../core/userLocal.js";
import {
  reconcileAchievementsWithCatalog,
  ACH_CATALOG,
} from "../core/achievements.js";
import { primaryBranchOf } from "../core/award.js";
import { loadActiveListId, loadLists, loadTasks } from "../core/storage.js";
import { DEFAULT_LISTS } from "./app.constants.js";

export const normalizeQuestType = (value) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "BASIC";
  return QUEST_TYPES[raw] ? raw : "BASIC";
};

export const stamp = (obj) => ({ ...obj, updatedAt: new Date().toISOString() });

export function makeEmptyAchievements() {
  return reconcileAchievementsWithCatalog({}, ACH_CATALOG);
}

export function normalizeTask(task) {
  if (!task || typeof task !== "object") return task;
  const branch =
    task.xpAwards && typeof task.xpAwards === "object"
      ? primaryBranchOf(task.xpAwards)
      : null;
  const category =
    task.category ||
    (branch === "SOCIAL"
      ? "social"
      : branch === "WISDOM"
        ? "learning"
        : branch === "HEALTH"
          ? "health"
          : undefined);
  const questType = normalizeQuestType(task.questType);
  return {
    ...task,
    listId: task.listId ?? "inbox",
    parentId: task.parentId ?? null,
    category,
    questType,
    updatedAt:
      task.updatedAt || task.doneAt || task.createdAt || new Date().toISOString(),
  };
}

export const normalizeTasks = (arr) =>
  Array.isArray(arr) ? arr.map(normalizeTask) : [];

export const loadInitialTasks = () => normalizeTasks(loadTasks());

export const loadInitialLists = () => {
  const stored = loadLists();
  return stored?.length ? stored : DEFAULT_LISTS;
};

export const loadInitialActiveListId = () => loadActiveListId() || "main";

export function clearLocalStorageByPrefix(prefix) {
  try {
    const keys = [];
    const nsPref = (() => {
      try {
        return nsKey(prefix);
      } catch {
        return null;
      }
    })();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(prefix)) {
        keys.push(k);
        continue;
      }
      if (nsPref && k.startsWith(nsPref)) {
        keys.push(k);
        continue;
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
