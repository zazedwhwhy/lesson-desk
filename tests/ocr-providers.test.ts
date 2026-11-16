import { afterEach, expect, it, vi } from 'vitest';
import { recognizeScan } from '../src/desktop/ocr';
import type { Settings, Source } from '../src/core/model';

vi.mock('node:fs/promises', () => ({ default: { readFile: vi.fn().mockResolvedValue(new Uint8Array()) } }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: () => ({ promise: Promise.resolve({
    numPages: 2,
    getPage: async () => ({
      getViewport: () => ({ width: 100, height: 150 }),
      render: () => ({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    }),
    loadingTask: { destroy: vi.fn() },
  }) }),
}));
afterEach(() => vi.unstubAllGlobals());

it.each(['openai', 'claude', 'custom', 'deepseek'] as const)('已选择 %s 时扫描识别使用当前模型，不要求切换 DeepSeek', async provider => {
  const settings: Settings = { provider, model: 'chosen-vision-alias', baseUrl: 'https://selected.example/v1' };
  const source: Source = { id: 'scan', name: 'scan.pdf', role: 'paper', kind: 'pdf', blocks: [], ocrPages: [1] };
  const text = JSON.stringify({ blank: false, blocks: ['原题内容'], uncertain: [] });
  const fetch = vi.fn().mockResolvedValue(Response.json(provider === 'claude' ? { stop_reason: 'end_turn', content: [{ type: 'text', text }] } : provider !== 'openai' ? { choices: [{ finish_reason: 'stop', message: { content: text } }] } : { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ blank: false, blocks: ['原题内容'], uncertain: [] }) }] }] }));
  vi.stubGlobal('fetch', fetch);
  const progress = vi.fn(async () => {});
  await expect(recognizeScan('scan.pdf', source, settings, 'test-key', new AbortController().signal, progress)).resolves.toMatchObject({ ocrPages: [], blocks: [{ text: '原题内容', page: 1 }] });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(source.ocrReviewPages).toEqual([1]);
  expect(source.ocrVerifiedPages).toEqual([]);
  expect(JSON.stringify(progress.mock.calls)).toContain(provider);
  expect(fetch.mock.calls[0][0]).toBe('https://selected.example/v1/' + (provider === 'openai' ? 'responses' : provider === 'claude' ? 'messages' : 'chat/completions'));
  expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('chosen-vision-alias');
});

it('Claude 扫描中途失败保留已识别页，剩余页继续待识别', async () => {
  const source: Source = { id: 'scan', name: 'scan.pdf', role: 'paper', kind: 'pdf', blocks: [], ocrPages: [1, 2] };
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ blank: false, blocks: ['第一页'], uncertain: [] }) }] }))
    .mockResolvedValueOnce(Response.json({ error: { type: 'authentication_error' } }, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  await expect(recognizeScan('scan.pdf', source, { provider: 'claude', model: 'chosen-model', baseUrl: 'https://api.example/v1' }, 'synthetic', new AbortController().signal, async () => {})).rejects.toThrow('401');
  expect(source.ocrPages).toEqual([2]);
  expect(source.ocrReviewPages).toEqual([1]);
  expect(source.blocks.map(b => b.text)).toEqual(['第一页']);
  expect(fetch).toHaveBeenCalledTimes(2);
});
