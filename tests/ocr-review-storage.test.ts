import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { emptyProject } from '../src/core/model';
import { applyOcrReview } from '../src/core/ocr-review';
import { Store } from '../src/desktop/store';

it.each(['english', 'chinese', 'chemistry'] as const)('%s 16页每页36段批量通过后可重载，保持内容与原始转录', async subject => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ocr-review-'));
  try {
    const store = new Store(dir), p = emptyProject('合成多页卷', subject);
    p.sources = [{ id: 's', name: '合成原卷.pdf', role: 'paper', kind: 'pdf', ocrPages: [], ocrReviewPages: Array.from({ length: 16 }, (_, i) => i + 1), blocks: Array.from({ length: 16 * 36 }, (_, i) => ({ id: 'b' + i, page: Math.floor(i / 36) + 1, text: '原卷文字、错字与选项均保留。'.repeat(12) })), ocrTranscriptions: [{ page: 3, at: 'synthetic', blocks: ['原始转录'], uncertain: [] }] }];
    await store.save(p);
    const latest = await store.load(p.id);
    const pages = latest.sources[0].ocrReviewPages!.map(page => ({ sourceId: 's', page, expectedBlocks: latest.sources[0].blocks.filter(b => b.page === page) }));
    await store.save(applyOcrReview(latest, { kind: 'verify', pages }));
    const saved = await store.load(p.id);
    expect(saved.sources[0].ocrVerifiedPages).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(saved.sources[0].blocks).toEqual(p.sources[0].blocks);
    expect(saved.sources[0].ocrTranscriptions).toEqual(p.sources[0].ocrTranscriptions);
    expect(saved.sources[0].ocrReviewPages).toEqual([]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
