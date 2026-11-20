import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { callAI } from '../src/desktop/ai';
import { promptBook } from '../src/desktop/prompt-store';
import { ServiceStopError } from '../src/core/generation-model';
import type { Settings } from '../src/core/model';
import { chineseGroupSchema } from '../src/core/chinese';
import { correctionPlanSchema } from '../src/core/correction';

afterEach(() => vi.unstubAllGlobals());
const schema = z.object({ text: z.string() });
const settings = (provider: string): Settings => ({ provider: provider as Settings['provider'], model: 'selected-model', baseUrl: 'https://selected.example/v1/' });
const reply = (provider: string, content = '{"text":"已识别"}') => provider === 'openai'
  ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: content }] }] }
  : provider === 'claude' ? { type: 'message', stop_reason: 'end_turn', content: [{ type: 'text', text: content }] }
    : { choices: [{ finish_reason: 'stop', message: { content } }] };

it.each(['openai', 'claude', 'deepseek', 'custom'])('%s 发送原样模型和图片，并验证输出', async provider => {
  const fetch = vi.fn().mockResolvedValue(Response.json(reply(provider)));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings(provider), 'synthetic-key', schema, 'provider-contract', new AbortController().signal, undefined, 'system rules', ['data:image/png;base64,YQ=='])).resolves.toEqual({ text: '已识别' });
  const [url, init] = fetch.mock.calls[0], body = JSON.parse(init.body);
  expect(url).toBe('https://selected.example/v1/' + (provider === 'openai' ? 'responses' : provider === 'claude' ? 'messages' : 'chat/completions'));
  expect(body.model).toBe('selected-model');
  expect(init.redirect).toBe('error');
  if (provider === 'claude') {
    expect(init.headers['x-api-key']).toBe('synthetic-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.headers.Authorization).toBeUndefined();
    expect(body.system).toBe('system rules');
    expect(body.messages[0].content).toContainEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'YQ==' } });
    expect(body.messages[0].content[0].text).toContain('"text"');
    expect(body.response_format).toBeUndefined();
  } else {
    expect(init.headers.Authorization).toBe('Bearer synthetic-key');
    if (provider === 'openai') expect(body.input[1].content).toContainEqual({ type: 'input_image', image_url: 'data:image/png;base64,YQ==', detail: 'auto' });
    else expect(body.messages[1].content).toContainEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,YQ==' } });
  }
  const preview = JSON.stringify(promptBook.snapshot().find(e => e.instruction === 'provider-contract')?.lastRequest);
  expect(preview).toContain('图片内容，预览省略');
  expect(preview).not.toContain('YQ==');
  expect(preview).not.toContain('synthetic-key');
});

it.each(['openai', 'claude'])('%s 文本请求不混入另一种协议', async provider => {
  const fetch = vi.fn().mockResolvedValue(Response.json(reply(provider)));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings(provider), 'synthetic-key', schema, '文本任务', new AbortController().signal)).resolves.toEqual({ text: '已识别' });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.max_output_tokens ?? body.max_tokens).toBe(16384);
  expect(JSON.stringify(body)).not.toContain('image');
});

it.each(['openai', 'claude'])('%s 凭据错误只请求一次，不切服务', async provider => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: { type: 'authentication_error' } }, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings(provider), 'synthetic-key', schema, '任务', new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  ['claude', { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"text":"partial"}' }] }, /截断|长度上限/],
  ['claude', { stop_reason: 'refusal', content: [] }, /拒绝/],
  ['claude', { stop_reason: 'tool_use', content: [] }, /完整结束/],
  ['claude', reply('claude', ' '), /空内容/],
  ['claude', reply('claude', '{}'), /结构不符合/],
  ['claude', reply('claude', 'not json'), /无效JSON/],
  ['openai', { ...reply('openai'), status: 'failed' }, /失败|完整结束/],
  ['openai', { ...reply('openai'), status: 'incomplete' }, /截断/],
] as const)('%s 不把失败响应保存为成功', async (provider, body, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
  await expect(callAI(settings(provider), 'synthetic-key', schema, '任务', new AbortController().signal)).rejects.toThrow(message);
});

it('未知服务商在发请求前阻断', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(reply('custom')));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings('unknown'), 'synthetic-key', schema, '任务', new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
  expect(fetch).not.toHaveBeenCalled();
});

it('不支持图片的接口明确报错且不重试或切换模型', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: 'unsupported_image' } }, { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings('openai'), 'synthetic-key', schema, '任务', new AbortController().signal, undefined, 'system', ['data:image/png;base64,YQ=='])).rejects.toThrow(/图片/);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('OpenAI 严格输出模式兼容语文整理的可选图片和分数，不把 null 注入业务数据', async () => {
  const outputSchema = z.object({ groups: z.array(chineseGroupSchema.omit({ versions: true })) });
  const output = { groups: [{ id: 'g', title: '原文', section: '阅读', kind: 'information', materials: [{ id: 'm', title: '原文', text: '文本', sourceId: 's', blockIds: ['b'], image: null, imageConfirmed: false }], questions: [{ id: 'q', number: '1', stem: '题干', format: 'short', materialIds: ['m'], options: [], answer: '', answerSource: 'none', score: null, confirmed: false, excluded: false }] }] };
  const fetch = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    function check(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object') {
        expect(node.required).toEqual(Object.keys(node.properties));
        expect(node.additionalProperties).toBe(false);
      }
      expect(node.default).toBeUndefined();
      for (const child of Object.values(node)) if (typeof child === 'object') check(child);
    }
    check(body.text.format.schema);
    return Response.json(reply('openai', JSON.stringify(output)));
  });
  vi.stubGlobal('fetch', fetch);
  const result = await callAI(settings('openai'), 'synthetic-key', outputSchema, '整理语文', new AbortController().signal);
  expect(result.groups[0].materials[0].image).toBeUndefined();
  expect(result.groups[0].questions[0].score).toBeUndefined();
});

it.each(['openai', 'claude'])('%s 取消后不发请求、不重试', async provider => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const controller = new AbortController(); controller.abort();
  await expect(callAI(settings(provider), 'synthetic-key', schema, '任务', controller.signal)).rejects.toThrow('已取消');
  expect(fetch).not.toHaveBeenCalled();
});

it('Claude 图片类型错误在发请求前报错', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings('claude'), 'synthetic-key', schema, '任务', new AbortController().signal, undefined, 'system', ['data:image/svg+xml;base64,YQ=='])).rejects.toThrow('图片');
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['openai', 'claude'])('%s HTTP成功但响应损坏时暂停，不填默认内容', async provider => {
  const fetch = vi.fn().mockResolvedValue(new Response('<html>proxy error</html>', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await expect(callAI(settings(provider), 'synthetic-key', schema, '任务', new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('OpenAI 可选字段恢复不允许必填字段为 null', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(reply('openai', '{"text":null}'))));
  await expect(callAI(settings('openai'), 'synthetic-key', schema, '任务', new AbortController().signal)).rejects.toThrow('结构不符合');
});

it('OpenAI 自动修正的判别联合转换为支持的 anyOf', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(reply('openai', '{"operations":[],"unresolved":[]}')));
  vi.stubGlobal('fetch', fetch);
  await callAI(settings('openai'), 'synthetic-key', correctionPlanSchema, '自动修正', new AbortController().signal);
  const output = JSON.parse(fetch.mock.calls[0][1].body).text.format.schema;
  expect(output.properties.operations.items.oneOf).toBeUndefined();
  expect(output.properties.operations.items.anyOf).toHaveLength(5);
});

it.each(['claude','custom'])('%s 返回了其他协议时停用队列的内容修正', async provider=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status:'completed',output:[]})));
  await expect(callAI(settings(provider),'test',schema,'任务',new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
});
it('响应 503 后保留手动继续，避免自动重复生成',async()=>{
  const fetch=vi.fn(async()=>new Response(null,{status:503}));vi.stubGlobal('fetch',fetch);
  await expect(callAI(settings('openai'),'test',schema,'任务',new AbortController().signal)).rejects.toThrow('503');
  expect(fetch).toHaveBeenCalledTimes(1);
});
