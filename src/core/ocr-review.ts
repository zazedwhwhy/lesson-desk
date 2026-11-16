import { z } from 'zod';
import { blockSchema, type Project } from './model';
import { pendingOcrPages } from './source-fidelity';

const pageSchema = z.object({ sourceId: z.string(), page: z.number().int().positive(), expectedBlocks: z.array(blockSchema) });
export const ocrReviewRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('verify'), pages: z.array(pageSchema).min(1) }),
  z.object({ kind: z.literal('correct'), page: pageSchema, texts: z.record(z.string(), z.string()) }),
]);
export type OcrReviewRequest = z.infer<typeof ocrReviewRequestSchema>;
export type OcrReviewPage = z.infer<typeof pageSchema>;
export const ocrPageKey = (sourceId: string, page: number) => JSON.stringify([sourceId, page]);

export function applyOcrReview(project: Project, raw: OcrReviewRequest): Project {
  const request = ocrReviewRequestSchema.parse(raw), next = structuredClone(project);
  const pages = request.kind === 'verify' ? request.pages : [request.page];
  const seen = new Set<string>();
  // Validate the entire selection before changing any page. The caller persists
  // once, using the latest project rather than an old renderer snapshot.
  for (const entry of pages) {
    const key = ocrPageKey(entry.sourceId, entry.page);
    if (seen.has(key)) throw Error('所选核对页面重复');
    seen.add(key);
    const source = next.sources.find(s => s.id === entry.sourceId);
    if (!source) throw Error('原材料已不存在，请重新打开课件');
    if (source.ocrPages?.includes(entry.page)) throw Error(`${source.name} 第${entry.page}页尚未识别完成，不能通过核对`);
    if (!pendingOcrPages(source).includes(entry.page)) throw Error('页面核对状态已变化，请重新打开课件');
    const blocks = source.blocks.filter(b => b.page === entry.page);
    const identity = (items: typeof blocks) => JSON.stringify(items.map(({ id, text, page, x, y }) => [id, text, page, x, y]));
    if (identity(blocks) !== identity(entry.expectedBlocks)) throw Error('原页内容已变化，未保存本次操作；请重新打开课件核对');
  }
  for (const entry of pages) {
    const source = next.sources.find(s => s.id === entry.sourceId)!;
    if (request.kind === 'verify') {
      source.ocrVerifiedPages = [...new Set([...(source.ocrVerifiedPages || []), entry.page])].sort((a, b) => a - b);
      source.ocrReviewPages = (source.ocrReviewPages || []).filter(n => n !== entry.page);
    } else {
      const before = structuredClone(source.blocks.filter(b => b.page === entry.page));
      if (Object.keys(request.texts).some(id => !before.some(b => b.id === id))) throw Error('校订段落不属于所选页面');
      source.blocks = source.blocks.map(b => b.page === entry.page && Object.hasOwn(request.texts, b.id) ? { ...b, text: request.texts[b.id] } : b);
      source.ocrCorrections ??= [];
      source.ocrCorrections.push({ page: entry.page, at: new Date().toISOString(), before, after: structuredClone(source.blocks.filter(b => b.page === entry.page)) });
      source.ocrVerifiedPages = (source.ocrVerifiedPages || []).filter(n => n !== entry.page);
      source.ocrReviewPages = [...new Set([...(source.ocrReviewPages || []), entry.page])];
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
