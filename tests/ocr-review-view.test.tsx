import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { OcrReview } from '../src/ui/OcrReview';
import { emptyProject } from '../src/core/model';

it('已对照外部原PDF的教师可以确认页面，不以应用内图片缓存为前提', () => {
  const p = emptyProject('OCR');
  p.sources = [{ id: 's', name: '原卷.pdf', role: 'paper', kind: 'pdf', ocrReviewPages: [3], ocrPages: [], blocks: [{ id: 'b', page: 3, text: '原题' }] }];
  const html = renderToStaticMarkup(<OcrReview project={p} onProject={() => {}}/>);
  const confirm = html.match(/<button([^>]*)>已对照原图核对第3页<\/button>/);
  expect(confirm).not.toBeNull();
  expect(confirm![1]).not.toContain('disabled');
});
