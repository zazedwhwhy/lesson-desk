import { expect, it } from 'vitest';
import { emptyProject } from '../src/core/model';
import { applyOcrReview } from '../src/core/ocr-review';
const fixture = () => {
  const p = emptyProject('OCR review');
  p.sources = ['paper', 'answer'].map((id, i) => ({ id, name: id + '.pdf', kind: 'pdf', role: i ? 'answer' : 'paper', ocrReviewPages: [1, 2], ocrPages: [], blocks: [{ id: id + '-1', page: 1, text: '原题错字' }, { id: id + '-2', page: 2, text: '未修改的题' }] }));
  return p;
};
const selection = (p: ReturnType<typeof fixture>, sourceId: string, page: number) => ({ sourceId, page, expectedBlocks: structuredClone(p.sources.find(s => s.id === sourceId)!.blocks.filter(b => b.page === page)) });

it('一次确认跨文件的选中页，未选页保持待核对，原输入不变', () => {
  const p = fixture(), before = structuredClone(p);
  const next = applyOcrReview(p, { kind: 'verify', pages: [selection(p, 'paper', 1), selection(p, 'answer', 2)] });
  expect(next.sources.map(s => s.ocrVerifiedPages)).toEqual([[1], [2]]);
  expect(next.sources.map(s => s.ocrReviewPages)).toEqual([[2], [1]]);
  expect(p).toEqual(before);
});
it('有一页尚未识别时整批不保存，不产生部分假通过', () => {
  const p = fixture(); p.sources[1].ocrPages = [2];
  expect(() => applyOcrReview(p, { kind: 'verify', pages: [selection(p, 'paper', 1), selection(p, 'answer', 2)] })).toThrow(/尚未识别/);
  expect(p.sources.every(s => !s.ocrVerifiedPages?.length)).toBe(true);
});
it('校订期间原页内容改变时拒绝过期确认', () => {
  const p = fixture(), page = selection(p, 'paper', 1); p.sources[0].blocks[0].text = '其他窗口的新校订';
  expect(() => applyOcrReview(p, { kind: 'verify', pages: [page] })).toThrow(/已变化/);
});
it('只保存本页校订并保留原始转录和其他页', () => {
  const p = fixture(); p.sources[0].ocrTranscriptions = [{ page: 1, at: 'before', blocks: ['原题错字'], uncertain: [] }];
  const next = applyOcrReview(p, { kind: 'correct', page: selection(p, 'paper', 1), texts: { 'paper-1': '原卷错字' } });
  expect(next.sources[0].blocks.map(b => b.text)).toEqual(['原卷错字', '未修改的题']);
  expect(next.sources[0].ocrCorrections?.[0].before[0].text).toBe('原题错字');
  expect(next.sources[0].ocrTranscriptions).toEqual(p.sources[0].ocrTranscriptions);
  expect(next.sources[0].ocrVerifiedPages).toEqual([]);
});
it('拒绝空选择、重复页和不属于本页的校订', () => {
  const p = fixture(), page = selection(p, 'paper', 1);
  expect(() => applyOcrReview(p, { kind: 'verify', pages: [] })).toThrow();
  expect(() => applyOcrReview(p, { kind: 'verify', pages: [page, page] })).toThrow(/重复/);
  expect(() => applyOcrReview(p, { kind: 'correct', page, texts: { 'answer-1': '越界修改' } })).toThrow(/不属于/);
});
