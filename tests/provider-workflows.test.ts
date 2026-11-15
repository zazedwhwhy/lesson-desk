import { afterEach, expect, it, vi } from 'vitest';
import { emptyProject, type Settings } from '../src/core/model';
import { demoProject } from '../src/core/demo';
import { chineseSchema } from '../src/core/chinese';
import { chemQuestionSchema } from '../src/core/chemistry';
import { generateGroup } from '../src/desktop/ai';
import { generateChinese, organizeChinese } from '../src/desktop/chinese';
import { chemistryCaller } from '../src/desktop/chemistry';

afterEach(() => vi.unstubAllGlobals());
const providers = ['openai', 'claude'] as const;
const signal = () => new AbortController().signal;
const settings = (provider: Settings['provider']): Settings => ({ provider, model: 'user-selected', baseUrl: 'https://api.example/v1' });
function mock(provider: Settings['provider'], output: unknown) {
  const text = JSON.stringify(output);
  const fetch = vi.fn(async (_url: string, _init: any) => Response.json(provider === 'openai'
    ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
    : { type: 'message', stop_reason: 'end_turn', content: [{ type: 'text', text }] }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

it.each(providers)('%s 英语逐题解析走真实调用链并保留原文证据', async provider => {
  const p = demoProject(), a = p.passages[0], q = p.questions[0];
  const fetch = mock(provider, { explanations: [{ questionId: q.id, answer: q.answer, analysis: '依据原文。', evidenceIds: ['C1'] }] });
  const result = await generateGroup(p, a.id, [q.id], settings(provider), 'synthetic', signal(), () => {});
  expect(result.questions[0].versions.at(-1)?.evidence.length).toBeGreaterThan(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});

function chinese() {
  const p = emptyProject('合成语文材料', 'chinese');
  p.sources = [{ id: 's', name: '原文', role: 'paper', kind: 'text', blocks: [{ id: 'b', text: '阅读材料：文字证据。题目：分析文字' }] }];
  p.chinese = chineseSchema.parse({ groups: [{ id: 'g', section: '阅读', title: '资料', kind: 'information', materials: [{ id: 'm', title: '原文', text: '文字证据。', sourceId: 's', blockIds: ['b'] }], questions: [{ id: 'q', number: '1', format: 'short', stem: '分析文字', materialIds: ['m'], confirmed: true, answer: '文字证据' }] }] });
  return p;
}
it.each(providers)('%s 语文整理保留来源，图片讲解进入实际请求', async provider => {
  const p = chinese();
  mock(provider, { groups: p.chinese!.groups });
  const result = await organizeChinese(p, settings(provider), 'synthetic', signal());
  expect(result.chinese.groups[0].materials[0].text).toBe('文字证据。');
  const m = result.chinese.groups[0].materials[0];
  m.image = 'data:image/png;base64,YQ=='; m.imageConfirmed = true;
  result.chinese.groups[0].questions[0].confirmed = true;
  const fetch = mock(provider, { status: 'ok', notices: [], blocks: [{ label: '解析', text: '依据原文', evidence: [{ materialId: 'm', quote: '文字证据。' }] }] });
  await generateChinese(result, ['g'], ['analysis'], settings(provider), 'synthetic', signal(), async () => {});
  expect(result.chinese.groups[0].versions.at(-1)?.result.status).toBe('ok');
  expect(JSON.stringify(JSON.parse(fetch.mock.calls[0][1].body))).toContain('YQ==');
});

it.each(providers)('%s 化学五模块共用协议，图示模式明确区分图片与文字', async provider => {
  const q = chemQuestionSchema.parse({ id: 'q', number: '1', stem: '检验 CO₂', answer: '澄清石灰水', confirmed: true, imageMode: 'vision', images: [{ id: 'i', name: '图示', data: 'data:image/png;base64,YQ==', description: '澄清石灰水', confirmed: true }] });
  const fetch = mock(provider, { status: 'ok', notices: [], blocks: [{ label: '知识', text: '二氧化碳使澄清石灰水变浑浊。' }] });
  const call = chemistryCaller(settings(provider), 'synthetic');
  for (const module of ['analysis', 'knowledge', 'method', 'experiment', 'practice'] as const) {
    expect((await call(q, module, signal())).status).toBe('ok');
  }
  expect(fetch).toHaveBeenCalledTimes(5);
  expect(fetch.mock.calls.every(([, init]) => init.body.includes('YQ=='))).toBe(true);
  q.imageMode = 'description';
  await call(q, 'knowledge', signal());
  expect(fetch.mock.calls[5][1].body).not.toContain('YQ==');
});
