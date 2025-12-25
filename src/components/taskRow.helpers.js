export function percentMilestones(task) {
  const subs = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const totalW = subs
    .filter((s) => s?.isMilestone)
    .reduce((a, s) => a + Math.max(0, Number(s.milestoneWeight) || 0), 0);
  const doneW = subs
    .filter((s) => s?.isMilestone && s.done)
    .reduce((a, s) => a + Math.max(0, Number(s.milestoneWeight) || 0), 0);
  if (totalW <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((doneW / totalW) * 100)));
}

