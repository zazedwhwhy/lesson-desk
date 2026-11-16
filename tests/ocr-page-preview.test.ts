import { afterEach, expect, it, vi } from 'vitest';
import { loadOcrPagePreview, OCR_PREVIEW_TIMEOUT_MS } from '../src/ui/ocr-page-preview';
const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: '' } }));
vi.mock('pdfjs-dist', () => pdf);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

it('原文件读取无响应时30秒结束等待，不永远占用页面状态', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { desk: { invoke: vi.fn(() => new Promise(() => {})) } });
  const promise = loadOcrPagePreview('p', 's', 1, new AbortController().signal);
  const verdict = expect(promise).rejects.toThrow('超时');
  await vi.advanceTimersByTimeAsync(OCR_PREVIEW_TIMEOUT_MS);
  await verdict;
  expect(pdf.getDocument).not.toHaveBeenCalled();
});

it('取消后迟到的原文件不再触发渲染或覆盖新状态', async () => {
  let finish!: (data: unknown) => void;
  vi.stubGlobal('window', { desk: { invoke: vi.fn(() => new Promise(resolve => { finish = resolve; })) } });
  const controller = new AbortController();
  const promise = loadOcrPagePreview('p', 's', 1, controller.signal);
  controller.abort(); await expect(promise).rejects.toThrow('取消');
  finish({ data: [] }); await Promise.resolve();
  expect(pdf.getDocument).not.toHaveBeenCalled();
});

function rendering(hang = false) {
  const cancel = vi.fn(), destroy = vi.fn(async () => {});
  const render = vi.fn((_input: { viewport: { height: number } }) => ({ promise: hang ? new Promise<void>(() => {}) : Promise.resolve(), cancel }));
  const page = { getViewport: ({ scale }: { scale: number }) => ({ width: 3000 * scale, height: 4000 * scale }), render };
  pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: async () => page }), destroy });
  const invoke = vi.fn(async () => ({ data: [1, 2, 3] }));
  vi.stubGlobal('window', { desk: { invoke } });
  const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,YQ==' };
  vi.stubGlobal('document', { createElement: () => canvas });
  return { render, cancel, destroy, invoke, canvas };
}

it('原图渲染可取消，清理卡住也不会继续锁住按钮', async () => {
  const f = rendering(true); f.destroy.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController(); const promise = loadOcrPagePreview('p', 's', 1, controller.signal);
  await vi.waitFor(() => expect(f.render).toHaveBeenCalledTimes(1));
  controller.abort(); await expect(promise).rejects.toThrow('取消');
  expect(f.cancel).toHaveBeenCalled(); expect(f.destroy).toHaveBeenCalled();
});

it('在前端渲染原PDF并限制画布尺寸，不调用阻塞主进程的原图渲染', async () => {
  const f = rendering();
  await expect(loadOcrPagePreview('p', 's', 2, new AbortController().signal)).resolves.toContain('data:image/jpeg');
  expect(f.invoke).toHaveBeenCalledWith('preview', 'p', 's');
  expect(f.render.mock.calls[0][0].viewport.height).toBe(2000);
  expect(f.destroy).toHaveBeenCalled(); expect(f.canvas.width).toBe(0);
});
