import { invoke } from './api';

export const OCR_PREVIEW_TIMEOUT_MS = 30000;

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    work.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

// PDF parsing uses PDF.js's browser worker. It must not run synchronously in
// Electron's main process, where a slow page would also block save/cancel IPC.
export async function loadOcrPagePreview(projectId: string, sourceId: string, pageNumber: number, external: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('原图加载超时，请重试；也可对照原PDF后确认页面。')), OCR_PREVIEW_TIMEOUT_MS);
  const cancel = () => controller.abort(new Error('已取消原图加载，可重新显示原图。'));
  external.addEventListener('abort', cancel, { once: true });
  if (external.aborted) cancel();
  const signal = controller.signal;
  let loading: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
  let render: { promise: Promise<void>; cancel: () => void } | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const release = () => { render?.cancel(); void loading?.destroy().catch(() => {}); };
  signal.addEventListener('abort', release, { once: true });
  try {
    if (signal.aborted) throw signal.reason;
    const { data } = await abortable(invoke('preview', projectId, sourceId), signal);
    const { getDocument, GlobalWorkerOptions } = await abortable(import('pdfjs-dist'), signal);
    if (signal.aborted) throw signal.reason;
    GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    loading = getDocument({ data: new Uint8Array(data) });
    const doc = await abortable(loading.promise, signal);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) throw Error('页码超出原PDF范围');
    const page = await abortable(doc.getPage(pageNumber), signal);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(1.3, 2000 / Math.max(natural.width, natural.height));
    const viewport = page.getViewport({ scale });
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw Error('无法创建原图预览，请重试');
    render = page.render({ canvas, canvasContext: context, viewport });
    await abortable(render!.promise, signal);
    if (signal.aborted) throw signal.reason;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    external.removeEventListener('abort', cancel);
    signal.removeEventListener('abort', release);
    // Cleanup is independent of the user action; a stalled worker teardown must
    // not keep the page controls disabled after render/cancel has completed.
    release();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
