import { expect, it } from 'vitest';
import { demoProject } from '../src/core/demo';
import { applyReviewBatch } from '../src/core/review';

it('批量核对只确认选中、未排除且有效的题目，并报告原因', () => {
  const p = demoProject(), q = p.questions[0]; q.confirmed = false;
  p.questions.push({ ...q, id: 'missing', number: '22', answer: '' }, { ...q, id: 'excluded', number: '23', excluded: true });
  const r = applyReviewBatch(p, p.questions.map(q => q.id), 'confirm');
  expect(r.project.questions.map(q => q.confirmed)).toEqual([true, false, false]);
  expect(r.changed).toBe(1); expect(r.skipped).toHaveLength(2);
  expect(r.skipped[0].reason).toContain('缺少参考答案');
  expect(p.questions[0].confirmed).toBe(false);
});
it('排除和恢复限定选择范围，保留讲解版本，恢复后重新核对', () => {
  const p = demoProject(); p.questions.push({ ...p.questions[0], id: 'untouched', number: '22' });
  const r = applyReviewBatch(p, [p.questions[0].id], 'exclude');
  expect(r.project.questions[0]).toMatchObject({ excluded: true, confirmed: false });
  expect(r.project.questions[0].versions).toEqual(p.questions[0].versions);
  expect(r.project.questions[1]).toEqual(p.questions[1]);
  const restored = applyReviewBatch(r.project, [p.questions[0].id], 'restore').project;
  expect(restored.questions[0]).toMatchObject({ excluded: false, confirmed: false });
});
