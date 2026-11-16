import { afterEach, expect, it, vi } from 'vitest';
import { demoProject } from '../src/core/demo';
import { planGeneration, runGeneration } from '../src/core/generation';
import { teachingSource } from '../src/core/logic';
import { generateGroup } from '../src/desktop/ai';
import { generationExecutor } from '../src/desktop/generation-service';

const settings = { provider: 'deepseek' as const, model: 'synthetic', baseUrl: 'https://synthetic.example' };
const row = (questionId: string, answer: string, analysis = '依据参考答案 A，原文的生物多样性对应 A 项。') => ({ questionId, answer, analysis, evidenceIds: ['C1'] });
const response = (explanations: ReturnType<typeof row>[]) => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ explanations }) } }] });
afterEach(() => vi.unstubAllGlobals());

it('原题答案偏离参考答案时不保存矛盾解析，合格同批题仍保存', async () => {
  const p = demoProject(), q = p.questions[0]; q.versions = []; delete q.activeVersion;
  p.questions.push({ ...structuredClone(q), id: 'q2', number: '22' });
  const planned = planGeneration(p, p.questions.map(q => q.id), 'analysis');
  vi.stubGlobal('fetch', vi.fn(async () => response([row(q.id, 'B', '独立解题后改选 B。'), row('q2', 'A')])));
  const next = await generateGroup(planned, q.passageId, [q.id, 'q2'], settings, 'synthetic', new AbortController().signal, () => {});
  expect(next.questions[0].answer).toBe('A');
  expect(next.questions[0].versions).toEqual([]);
  expect(next.job.tasks![0]).toMatchObject({ state: 'failed', error: expect.stringContaining('参考答案') });
  expect(next.questions[1].versions[0].answer).toBe('A');
});

it('偏离参考答案后仅修正失败题，修正仍保留答案及对应解析', async () => {
  const p = demoProject(), q = p.questions[0]; q.versions = []; delete q.activeVersion;
  const planned = planGeneration(p, [q.id], 'analysis'), signal = new AbortController().signal;
  const fetch = vi.fn().mockResolvedValueOnce(response([row(q.id, 'B', '误把 B 作为答案。')])).mockResolvedValueOnce(response([row(q.id, 'A')]));
  vi.stubGlobal('fetch', fetch);
  const next = await runGeneration(planned, signal, generationExecutor(settings, 'synthetic', signal, () => {}), async () => {});
  expect(next.job.state).toBe('complete');
  expect(next.questions[0].versions).toHaveLength(1);
  expect(next.questions[0].versions[0]).toMatchObject({ answer: 'A', analysis: '依据参考答案 A，原文的生物多样性对应 A 项。', conflict: false });
  expect(fetch).toHaveBeenCalledTimes(2);
  const repair = JSON.parse(fetch.mock.calls[1][1].body).messages[1].content;
  expect(repair).toContain('参考答案');
});

it.each([
  ['reading', 'A/C', 'A'],
  ['writing', '题给参考范文，保留其措辞。', 'AI重新写的另一篇范文。'],
  ['grammar', 'US', 'us'],
] as const)('%s 不把参考答案的一部分、替代范文或大小写改写当成原答案', async (type, reference, answer) => {
  const p = demoProject(), q = p.questions[0]; q.type = type; q.answer = reference; q.versions = []; delete q.activeVersion;
  vi.stubGlobal('fetch', vi.fn(async () => response([row(q.id, answer)])));
  await expect(generateGroup(p, q.passageId, [q.id], settings, 'synthetic', new AbortController().signal, () => {})).rejects.toThrow('参考答案');
  expect(q.answer).toBe(reference);
  expect(q.versions).toEqual([]);
});

it.each(['reading', 'writing'] as const)('%s 无参考答案时显式标识AI建议待核实，不填回原题答案', async type => {
  const p = demoProject(), q = p.questions[0]; q.type = type; q.answer = ''; q.versions = []; delete q.activeVersion;
  vi.stubGlobal('fetch', vi.fn(async () => response([row(q.id, 'AI建议答案', '仅据现有材料给出的建议。')])));
  const next = await generateGroup(p, q.passageId, [q.id], settings, 'synthetic', new AbortController().signal, () => {});
  expect(next.questions[0].answer).toBe('');
  expect(next.questions[0].versions[0].analysis).toMatch(/AI建议.*待.*核实/);
  expect(next.questions[0].versions[0].conflict).toBe(false);
});

it('原题参考答案约束不替换已保存的新编练习独立答案', async () => {
  const p = demoProject(), q = p.questions[0], old = q.versions[0];
  old.sourceText = teachingSource(p, q.passageId);
  const exercise = structuredClone(old.exercise);
  vi.stubGlobal('fetch', vi.fn(async () => response([row(q.id, 'A')])));
  const next = await generateGroup(p, q.passageId, [q.id], settings, 'synthetic', new AbortController().signal, () => {});
  expect(next.questions[0].versions.at(-1)?.exercise).toEqual(exercise);
});
