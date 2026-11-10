import { issues } from './logic';
import type { Project } from './model';

export type ReviewAction = 'confirm' | 'exclude' | 'restore' | 'unconfirm';
export function applyReviewBatch(p: Project, ids: string[], action: ReviewAction) {
  if (!ids.length) throw Error('请先勾选需要操作的题目');
  if (ids.some(id => !p.questions.some(q => q.id === id))) throw Error('所选题目已变化，请重新选择');
  const project = structuredClone(p), selected = new Set(ids);
  const skipped: { id: string; number: string; reason: string }[] = [];
  let changed = 0;
  for (const q of project.questions.filter(q => selected.has(q.id))) {
    const before = [q.confirmed, q.excluded].join();
    if (action === 'confirm') {
      const reasons = q.excluded ? ['本题已排除，请先恢复'] : issues(project, q);
      if (reasons.length) { skipped.push({ id: q.id, number: q.number, reason: reasons.join('；') }); continue; }
      q.confirmed = true;
    } else if (action === 'exclude') { q.excluded = true; q.confirmed = false; }
    else if (action === 'restore' && q.excluded) { q.excluded = false; q.confirmed = false; }
    else if (action === 'unconfirm') q.confirmed = false;
    if (before !== [q.confirmed, q.excluded].join()) changed++;
  }
  return { project, changed, skipped };
}
