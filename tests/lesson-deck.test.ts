import { expect, it } from 'vitest';
import { demoProject } from '../src/core/demo';
import { buildLessonDeck, defaultLessonSelection, lessonSelectionIssues } from '../src/core/lesson-deck';
import { specialFingerprint } from '../src/core/special';

it('长解析分页保留原文和AI解析全部字符', () => {
  const p = demoProject(), q = p.questions[0], analysis = '解题依据：' + '根据原文逐项核对。'.repeat(300);
  q.versions[0].analysis = analysis;
  const pages = buildLessonDeck(p, defaultLessonSelection(p)).filter(s => s.kind === 'analysis');
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.flatMap(s => s.blocks.filter(b => b.label.startsWith('AI 解析')).map(b => b.text)).join('')).toBe(analysis);
});

it('未完成项可排除，选入过期模块时说明原因', () => {
  const p = demoProject(), selection = defaultLessonSelection(p), pid = p.passages[0].id;
  p.passages[0].learning!.stale = true;
  expect(lessonSelectionIssues(p, selection).some(s => s.includes('已过期'))).toBe(true);
  selection.modules[pid] = selection.modules[pid].filter(m => !['sentences', 'structure', 'lexicon', 'imitation'].includes(m));
  expect(lessonSelectionIssues(p, selection)).toEqual([]);
  expect(buildLessonDeck(p, selection).some(s => s.kind === 'analysis')).toBe(true);
});

it('同一练习不重复放映，专项讲评中的依据和答案进入课件', () => {
  const p = demoProject(), a = p.passages[0], fingerprint = specialFingerprint(p, a.id);
  a.special = { active: { option_evidence: 'special-1' }, versions: [{ id: 'special-1', kind: 'option_evidence', createdAt: new Date().toISOString(), sourceText: fingerprint, input: { material_complete: true, extra: '', opening1: '', opening2: '', questionIds: [p.questions[0].id] }, result: { status: 'ok', notices: [], items: [{ question_id: p.questions[0].id, question_number: '21', reference_answer: 'A', key_reason: '原文提到丰富的动植物种类。', options: [{ label: 'A', verdict: 'supported', evidence: [{ source_id: 'b', location: '原文', quote: 'great variety of plant and animal life' }], reasoning: '与题干同义。', error_pattern: '' }], teacher_question: '哪一句支持 A？' }] } }] };
  const deck = buildLessonDeck(p, defaultLessonSelection(p));
  expect(deck.some(s => s.kind === 'practice' && s.title.includes('补充练习 1'))).toBe(true);
  expect(deck.some(s => s.kind === 'practice' && s.title.includes('补充练习 2'))).toBe(false);
  const special = deck.filter(s => s.kind === 'special').flatMap(s => s.body).join('\n');
  expect(special).toContain('原文提到丰富的动植物种类');
  expect(special).toContain('great variety of plant and animal life');
  expect(special).toContain('A');
});
