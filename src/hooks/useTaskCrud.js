// src/hooks/useTaskCrud.js
import { useCallback } from "react";
import { uid, PRAISES } from "../utils/constants.js";
import { QUEST_TYPES } from "../core/constants.js";
import { computeDeadlineISO, nextDeadline } from "../core/dates.js";
import { awardXPForTask, releaseMilestonePayouts, primaryBranchOf } from "../core/award.js";
import { loadMultiXP, saveMultiXP } from "../core/multixp.js";
import { loadProfile, saveProfile } from "../core/profile.js";
import { evaluateNewPerks, applyPerkEffects } from "../core/perkEngine.js";
import { normalizeQuestType, stamp } from "../app/app.helpers.js";
import { playRandomSfx } from "../utils/sfx.js";
import { emitXpGainEvent } from "../core/xpEvents.js";
import { loadXP } from "../core/storage.js";

export default function useTaskCrud({
  tasks,
  setTasks,
  setXp,
  enqueueToast,
  lastActionRef,
  addRandomSymbol,
  activeListId,
  level,
  xp: globalXp = 0,
  composerInputs = {},
  soundsEnabled = true,
}) {
  const {
    text = "",
    setText,
    aiText = "",
    setAiText,
    xpInput = "",
    setXpInput,
    deadlineAmt = "",
    setDeadlineAmt,
    deadlineUnit = "h",
    setDeadlineUnit,
    absoluteDue = null,
    setAbsoluteDue,
    desc = "",
    setDesc,
    recur = "none",
    setRecur,
    recurCustom = [],
    setRecurCustom,
    recurWeeklyDays = [],
    setRecurWeeklyDays,
  } = composerInputs;

  const addTask = useCallback((payload = {}) => {
    if (!setTasks) return;
    if (lastActionRef) lastActionRef.current = "add";
    const providedTitle = typeof payload.title === "string" ? payload.title.trim() : "";
    const fallbackTitle = (text || aiText).trim();
    const title = providedTitle || fallbackTitle;
    if (!title) return;

    const baseCandidate = payload.baseXp ?? payload.xpBase ?? xpInput ?? 1;
    const baseXp = Math.max(1, parseInt(baseCandidate, 10) || 1);
    const xpAwards = (payload.xpAwards && typeof payload.xpAwards === "object") ? payload.xpAwards : {};

    const questType = normalizeQuestType(payload.questType);
    const primary = payload.primaryBranch ?? primaryBranchOf(xpAwards);
    const category = payload.category ?? (primary === "SOCIAL" ? "social" : primary === "WISDOM" ? "learning" : primary === "HEALTH" ? "health" : undefined);

    const descValue = (typeof payload.description === "string" ? payload.description : (payload.desc ?? desc ?? "")).trim();
    const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();
    const recurValue = payload.recur ?? recur;
    const recurCustomValue = payload.recurCustom ?? recurCustom;
    const recurWeeklyDaysValue = payload.recurWeeklyDays ?? recurWeeklyDays;

    const deadline = payload.deadline ?? computeDeadlineISO({
      absoluteDue: payload.absoluteDue ?? absoluteDue,
      deadlineAmt: payload.deadlineAmt ?? deadlineAmt,
      deadlineUnit: payload.deadlineUnit ?? deadlineUnit,
      now: Date.now()
    });

    const listId = payload.listId ?? activeListId;
    const subtasks = Array.isArray(payload.subtasks)
      ? payload.subtasks.map((sub, idx) => ({
          ...sub,
          id: sub?.id || `ms_${idx + 1}`,
          isMilestone: !!sub?.isMilestone,
          milestoneWeight: Math.max(0, parseInt(sub?.milestoneWeight ?? sub?.weight ?? 0, 10) || 0),
          done: !!sub?.done,
          paid: !!sub?.paid,
        }))
      : undefined;
    const escrow = (payload.escrow && typeof payload.escrow === "object")
      ? { mode: payload.escrow.mode || (QUEST_TYPES[questType]?.escrow ?? "none"), paid: !!payload.escrow.paid }
      : { mode: QUEST_TYPES[questType]?.escrow ?? "none", paid: false };

    setTasks(p => [stamp({
      id: uid(), title,
      ...(descValue ? { desc: descValue } : {}),
      recur: recurValue,
      ...(recurValue === "weekly" && Array.isArray(recurWeeklyDaysValue) ? { recurWeeklyDays: Array.from(new Set(recurWeeklyDaysValue.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6))).sort((a, b) => a - b) } : {}),
      ...(recurValue === "custom" && Array.isArray(recurCustomValue) ? { recurCustom: recurCustomValue } : {}),
      xp: baseXp, baseXp, xpBase: baseXp,
      xpAwards, ...(category ? { category } : {}),
      questType, escrow,
      done: !!payload.done && payload.done !== false,
      createdAt, deadline, parentId: payload.parentId ?? null, listId,
      ...(payload.deadlineLocked ? { deadlineLocked: true } : {}),
      ...(Array.isArray(subtasks) ? { subtasks } : {})
    }), ...p]);

    setText && setText("");
    setAiText && setAiText("");
    setXpInput && setXpInput("");
    setDeadlineAmt && setDeadlineAmt("");
    setDeadlineUnit && setDeadlineUnit("h");
    setAbsoluteDue && setAbsoluteDue(null);
    setDesc && setDesc("");
    setRecur && setRecur("none");
    setRecurCustom && setRecurCustom([]);
    setRecurWeeklyDays && setRecurWeeklyDays([new Date().getDay()]);
  }, [activeListId, absoluteDue, aiText, deadlineAmt, deadlineUnit, desc, lastActionRef, recur, recurCustom, recurWeeklyDays, setAbsoluteDue, setAiText, setDeadlineAmt, setDeadlineUnit, setDesc, setRecur, setRecurCustom, setRecurWeeklyDays, setTasks, setText, setXpInput, text, xpInput]);
  const onAddSubtask = useCallback((parentId, title, subXP, after) => {
    const t = (title || "").trim(); if (!t) return;
    const parent = tasks.find(x => x.id === parentId);
    const parentListId = parent?.listId || activeListId;
    const parentBase = Math.max(1, parseInt(parent?.baseXp ?? parent?.xp ?? 1, 10) || 1);
    const currentKids = tasks.filter(x => x.parentId === parentId);
    const consumedPct = (() => {
      const toVal = (xp, base) => {
        if (typeof xp === "string" && xp.trim().endsWith("%")) { const pct = Math.max(1, Math.min(200, parseInt(xp.trim().slice(0, -1), 10) || 0)); return Math.max(1, Math.round(base * (pct / 100))); }
        return Math.max(1, parseInt(xp || 1, 10));
      };
      const sum = (currentKids || []).reduce((a, c) => a + toVal(c?.xp, parentBase), 0);
      return Math.round((sum / parentBase) * 100);
    })();
    const capReached = consumedPct >= 200;
    let finalXP;
    if (capReached) {
      finalXP = 1;
    } else if (typeof subXP === "string" && subXP.trim().endsWith("%")) {
      const pct = Math.max(1, Math.min(200, parseInt(subXP.trim().slice(0, -1), 10) || 0));
      finalXP = Math.max(1, Math.round(parentBase * (pct / 100)));
    } else {
      finalXP = Math.max(1, parseInt(subXP || 1, 10));
    }
    setTasks(p => [stamp({ id: uid(), title: t, xp: finalXP, done: false, createdAt: new Date().toISOString(), deadline: null, parentId, listId: parentListId, }), ...p]);
    after && after();
  }, [tasks, setTasks, activeListId]);

  const onRenameTitle = useCallback((taskId, newTitle) => {
    const v = (newTitle || "").trim(); if (!v) return;
    setTasks(prev => prev.map(t => t.id === taskId ? stamp({ ...t, title: v }) : t));
  }, [setTasks]);

  const onUpdateTask = useCallback((taskId, fields = {}) => {
    if (!taskId || !fields || typeof fields !== 'object') return;
    setTasks(prev => prev.map(t => t.id === taskId ? stamp({ ...t, ...fields }) : t));
  }, [setTasks]);

  function applyMilestonePayouts(task, subs) {
    if (!task || !Array.isArray(subs)) return subs;
    let toastInfo = null;
    const before = loadMultiXP();
    const payout = releaseMilestonePayouts(
      { ...task, subtasks: subs },
      { incGlobalXP: delta => setXp(prev => prev + delta) }
    );
    const after = loadMultiXP();
    const keys = ['WISDOM','HEALTH','STRENGTH','SOCIAL','TRADE','ATHLETICS'];
    const branchApplied = Object.fromEntries(keys.map(k => [k, Math.max(0, (after?.xp?.[k]||0) - (before?.xp?.[k]||0))]));
    const baseApplied = (Array.isArray(payout?.payouts) ? payout.payouts : []).reduce((a,p)=> a + Math.max(0, parseInt(p?.baseGlobal||0,10)||0), 0);
    if (Array.isArray(payout?.applied) && payout.applied.length > 0) {
      const paidSet = new Set(payout.applied);
      subs = subs.map((sub, idx2) => {
        if (!sub?.isMilestone) return sub;
        const key = `task:${task.id || '?'}:ms:${sub.id || idx2}`;
        return paidSet.has(key) ? { ...sub, paid: true } : sub;
      });
    }
    return subs.map((sub, i) => (sub?.isMilestone ? { ...sub, msSnapshot: { base: baseApplied, branches: branchApplied, at: new Date().toISOString() } } : sub));
  }

  const markMilestoneDone = useCallback((taskId, milestoneKey) => {
    if (!taskId) return;
    let toastInfo = null;
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId); if (idx === -1) return prev;
      const task = prev[idx];
      const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
      if (subs.length === 0) return prev;
      const targetIndex = subs.findIndex((s, i) => (s?.id ?? String(i)) === milestoneKey);
      if (targetIndex === -1) return prev;
      const target = subs[targetIndex];
      if (!target?.isMilestone) return prev;
      const stampAt = new Date().toISOString();
      if (!target.done) {
        const weight = Math.max(0, Number(target?.milestoneWeight) || 0);
        toastInfo = { taskTitle: task.title, milestoneTitle: target?.title || null, weight };
        let updatedSubs = subs.map((sub, i) => (i === targetIndex ? { ...sub, done: true, doneAt: sub?.doneAt || stampAt } : { ...sub }));
        updatedSubs = applyMilestonePayouts(task, updatedSubs);
        const updatedTask = { ...task, subtasks: updatedSubs };
        const next = prev.slice(); next[idx] = stamp(updatedTask); return next;
      } else {
        const snap = target?.msSnapshot;
        if (snap) { revertAwardsSnapshot(snap); }
        const updatedSubs = subs.map((sub, i) => (i === targetIndex ? { ...sub, done: false, paid: false, msSnapshot: null } : sub));
        const updatedTask = { ...task, subtasks: updatedSubs };
        const next = prev.slice(); next[idx] = stamp(updatedTask); return next;
      }
    });
    if (toastInfo) {
      if (soundsEnabled) playRandomSfx();
      const baseLabel = toastInfo.milestoneTitle ? `Milestone complete: ${toastInfo.milestoneTitle}` : "Milestone complete!";
      const weightSuffix = toastInfo.weight > 0 ? ` (+${toastInfo.weight}%)` : "";
      enqueueToast(baseLabel + weightSuffix, 1500);
    }
  }, [setTasks, enqueueToast, setXp]);

  function awardWithPerks(taskForAward, xpBeforeGlobal) {
    const prof = loadProfile();
    const liveMx = loadMultiXP();
    const owned = Array.from(
      new Set([
        ...(prof?.perks?.owned || []),
        ...(prof?.multixp?.perks || []),
        ...(liveMx?.perks || []),
      ])
    );
    const rawAwards = taskForAward?.xpAwards && typeof taskForAward.xpAwards === "object" ? taskForAward.xpAwards : {};
    const effAwards = applyPerkEffects(rawAwards, owned);
    const enriched = { ...taskForAward, xpAwards: effAwards };
    const before = loadMultiXP();
    const res = awardXPForTask(enriched, (delta) => setXp(prev => prev + delta));
    const after = loadMultiXP();
    const xpTypes = ['WISDOM','HEALTH','STRENGTH','SOCIAL','TRADE','ATHLETICS'];
    const branchApplied = {};
    const branchesBefore = {};
    const branchesAfter = {};
    xpTypes.forEach(k => {
      branchesBefore[k] = Math.max(0, before?.xp?.[k] || 0);
      branchesAfter[k] = Math.max(0, after?.xp?.[k] || 0);
      branchApplied[k] = Math.max(0, (after?.xp?.[k]||0) - (before?.xp?.[k]||0));
    });
    const post = loadProfile();
    // Only consider skill-tree perks here; achievement and daily perks are synced elsewhere.
    const skillNew = evaluateNewPerks(post, owned, { level }).filter(p => p?.source?.type === "skill");
    if (skillNew.length) {
      const nextOwned = Array.from(new Set([...owned, ...skillNew.map(p => p.id)]));
      const nextMx = {
        ...(liveMx || {}),
        perks: Array.from(new Set([...(liveMx?.perks || []), ...nextOwned])),
      };
      saveMultiXP(nextMx);
      post.perks = { ...(post.perks || {}), owned: nextOwned };
      post.multixp = {
        ...(post.multixp || {}),
        ...nextMx,
      };
      saveProfile({ ...post, updatedAt: Date.now() });
      const verify = loadProfile();
      const ownedSet = new Set(verify?.perks?.owned || []);
      skillNew.filter(p => ownedSet.has(p.id)).forEach(p => enqueueToast(`Perk unlocked: ${p.label}!`, 1800));
    }
    const baseDelta = res?.base || 0;
    const globalBefore = Number.isFinite(xpBeforeGlobal) ? xpBeforeGlobal : loadXP();
    return {
      base: baseDelta,
      branches: branchApplied,
      branchesBefore,
      branchesAfter,
      globalBefore,
      globalAfter: globalBefore + baseDelta,
    };
  }

  function revertAwardsSnapshot(snap) {
    if (!snap) return;
    const base = Math.max(0, parseInt(snap.base||0,10) || 0);
    if (base > 0) setXp(prev => Math.max(0, (prev||0) - base));
    try {
      const cur = loadMultiXP();
      const next = { ...cur, xp: { ...cur.xp } };
      const keys = ['WISDOM','HEALTH','STRENGTH','SOCIAL','TRADE','ATHLETICS'];
      for (const k of keys) {
        const cut = Math.max(0, parseInt(snap.branches?.[k]||0,10) || 0);
        if (cut <= 0) continue;
        next.xp[k] = Math.max(0, (next.xp[k]||0) - cut);
      }
      saveMultiXP(next);
      const prof = loadProfile();
      prof.multixp = { ...prof.multixp, ...next };
      saveProfile(prof);
    } catch {}
  }

  function snapshotDeadlineFields(task) {
    if (!task) return null;
    const snapshot = {
      deadline: task.deadline ?? null,
      absoluteDue: task.absoluteDue ?? null,
      deadlineAmt: task.deadlineAmt ?? null,
      deadlineUnit: task.deadlineUnit ?? null,
      deadlineLocked: !!task.deadlineLocked,
    };
    const hasValue =
      snapshot.deadline ||
      snapshot.absoluteDue ||
      snapshot.deadlineAmt != null ||
      snapshot.deadlineUnit != null ||
      snapshot.deadlineLocked;
    return hasValue ? snapshot : null;
  }

  function restoreDeadlineFromSnapshot(snapshot, task) {
    const base = { doneAt: null, deadlineSnapshot: null };
    if (!snapshot) return base;
    return {
      ...base,
      deadline: snapshot.deadline ?? null,
      absoluteDue: snapshot.absoluteDue ?? null,
      deadlineAmt: snapshot.deadlineAmt ?? null,
      deadlineUnit: snapshot.deadlineUnit ?? null,
      deadlineLocked:
        typeof snapshot.deadlineLocked === "boolean"
          ? snapshot.deadlineLocked
          : task?.deadlineLocked ?? false,
    };
  }

  const toggleTask = useCallback((id) => {
    const effect = { toasted: false, addSymbol: false, xpEvent: null };
    const xpBefore = Number.isFinite(globalXp) ? globalXp : loadXP();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const current = prev[idx];
      const turningDone = !current.done;
      const timestamp = new Date().toISOString();
      let nextList = prev.slice();
      let preparedSubs = null;
      if (turningDone && current?.escrow?.mode === "milestone" && Array.isArray(current.subtasks)) {
        preparedSubs = current.subtasks.map((sub) => {
          if (!sub) return sub;
          if (!sub?.isMilestone) return { ...sub };
          return { ...sub, done: true, doneAt: sub?.doneAt || timestamp, paid: !!sub?.paid };
        });
        preparedSubs = applyMilestonePayouts(current, preparedSubs);
      }
      const deadlineSnapshot = turningDone ? snapshotDeadlineFields(current) : null;
      const timelineFields = turningDone
        ? {
            deadline: null,
            absoluteDue: null,
            deadlineAmt: null,
            deadlineUnit: null,
            doneAt: timestamp,
            deadlineSnapshot,
          }
        : restoreDeadlineFromSnapshot(current.deadlineSnapshot, current);

      if (turningDone) {
        lastActionRef && (lastActionRef.current = "complete");
        let taskForAward = current;
        if (current?.escrow?.mode === "milestone") {
          const subsForWeight = Array.isArray(preparedSubs) ? preparedSubs : (Array.isArray(current.subtasks) ? current.subtasks : []);
          const paidWeight = subsForWeight.reduce((acc, sub) => (!sub?.isMilestone || !sub.paid) ? acc : acc + Math.max(0, Number(sub?.milestoneWeight) || 0), 0);
          const baseValue = Math.max(0, parseInt(current.baseXp ?? current.xp ?? 0, 10) || 0);
          const remainingPortion = Math.max(0, Math.min(1, (100 - paidWeight) / 100));
          const scaledBase = Math.round(baseValue * remainingPortion);
          const scaledAwards = {};
          if (current.xpAwards && typeof current.xpAwards === "object") {
            Object.entries(current.xpAwards).forEach(([k, v]) => {
              const val = Math.max(0, parseInt(v, 10) || 0); if (val <= 0) return;
              const scaled = Math.round(val * remainingPortion); if (scaled > 0) scaledAwards[k] = scaled;
            });
          }
          taskForAward = { ...current, baseXp: scaledBase, xpBase: scaledBase, xpAwards: scaledAwards, allowZeroBase: true };
        }
        const awardInfo = awardWithPerks(taskForAward, xpBefore);
        const updatedTask = stamp({
          ...current,
          done: true,
          ...timelineFields,
          ...(preparedSubs ? { subtasks: preparedSubs } : {}),
          awardSnapshot: { ...awardInfo, at: timestamp },
        });
        nextList[idx] = updatedTask;
        const hasDelta = (awardInfo.base > 0) || Object.values(awardInfo.branches || {}).some(v => v > 0);
        if (hasDelta) {
          effect.xpEvent = {
            type: "xp_gain",
            reason: "task_complete",
            taskId: current.id,
            title: current.title,
            questType: normalizeQuestType(current.questType),
            listId: current.listId,
            parentId: current.parentId || null,
            timestamp,
            delta: { global: awardInfo.base, branches: awardInfo.branches },
            totals: {
              globalBefore: awardInfo.globalBefore,
              globalAfter: awardInfo.globalAfter,
              branchesBefore: awardInfo.branchesBefore,
              branchesAfter: awardInfo.branchesAfter,
            },
            meta: {
              levelAtCompletion: level,
              baseXp: taskForAward?.baseXp ?? taskForAward?.xp ?? 0,
              xpAwards: taskForAward?.xpAwards || {},
            },
          };
        }
        if (current.recur && current.recur !== "none") {
          const nd = nextDeadline(current);
          const clone = stamp({
            id: uid(),
            title: current.title,
            desc: current.desc,
            recur: current.recur,
            ...(Array.isArray(current.recurWeeklyDays) ? { recurWeeklyDays: current.recurWeeklyDays } : {}),
            ...(Array.isArray(current.recurCustom) ? { recurCustom: current.recurCustom } : {}),
            xp: current.baseXp ?? current.xp ?? 1,
            baseXp: current.baseXp ?? current.xp ?? 1,
            xpAwards: current.xpAwards || {},
            category: current.category,
            questType: normalizeQuestType(current.questType),
            done: false,
            createdAt: new Date().toISOString(),
            deadline: nd,
            parentId: null,
            listId: current.listId || activeListId,
          });
          nextList = [clone, ...nextList];
        }
        effect.toasted = true;
        effect.addSymbol = !current.parentId && !!addRandomSymbol;
        return nextList;
      }

      const snap = current?.awardSnapshot;
      if (snap) revertAwardsSnapshot(snap);
      lastActionRef && (lastActionRef.current = null);
      const updatedTask = stamp({
        ...current,
        done: false,
        ...timelineFields,
        awardSnapshot: null,
      });
      nextList[idx] = updatedTask;
      return nextList;
    });
    if (effect.xpEvent) emitXpGainEvent(effect.xpEvent);
    if (effect.toasted) {
      if (soundsEnabled) playRandomSfx();
      enqueueToast(PRAISES[Math.floor(Math.random() * PRAISES.length)], 1500);
      if (effect.addSymbol) addRandomSymbol();
    }
  }, [setTasks, setXp, enqueueToast, addRandomSymbol, activeListId, lastActionRef, soundsEnabled, globalXp]);

  const removeTask = useCallback((id) => {
    lastActionRef && (lastActionRef.current = "remove");
    const rm = new Set([id]); const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      tasks.forEach(t => { if (t.parentId === cur) { rm.add(t.id); stack.push(t.id); } });
    }
    const timestamp = new Date().toISOString();
    setTasks(p => p.map(t => rm.has(t.id) ? stamp({ ...t, deleted: true, deletedAt: timestamp }) : t));
  }, [tasks, setTasks, lastActionRef]);

  const removeTaskWithConfirm = useCallback((id) => {
    const t = tasks.find(x => x.id === id);
    const title = t?.title ? `"${t.title}"` : "this task";
    if (confirm(`Delete ${title}? All its subtasks will also be removed.`)) removeTask(id);
  }, [tasks, removeTask]);

  return { addTask, onAddSubtask, onRenameTitle, onUpdateTask, toggleTask, removeTask, removeTaskWithConfirm, markMilestoneDone };
}
