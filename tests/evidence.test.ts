import { expect, it } from 'vitest';
import { resolveEvidence,createCitationCatalog,citation } from '../src/core/evidence';

const blocks = [{ id: 'b1', text: 'It’s about supporting\n families and creating ___41___ for love.' }];
it('兼容引号与连续空白，并恢复原文供高亮', () => {
  expect(resolveEvidence(blocks, { blockId: 'b1', quote: "It's about supporting families" }))
    .toEqual({ blockId: 'b1', quote: 'It’s about supporting\n families' });
});
it('不把填入完形答案后的句子冒充原文', () => {
  expect(() => resolveEvidence(blocks, { blockId: 'b1', quote: 'creating opportunities for love' }))
    .toThrow('引用文字与该段原文不一致');
});
it('不跨段猜测引用，不吞掉缺失ID', () => {
  expect(() => resolveEvidence(blocks, { blockId: 'wrong', quote: 'for love' })).toThrow('段落编号');
  expect(() => resolveEvidence(blocks, { blockId: 'b1', quote: ' ' })).toThrow('引用为空');
});
it('不接受同义改写或模糊匹配', () => {
  expect(() => resolveEvidence(blocks, { blockId: 'b1', quote: 'for loving' })).toThrow();
});
it('标准化后多处命中时不擅自定位', () => {
  expect(() => resolveEvidence([{ id: 'b', text: 'a\nb then a\t b' }], { blockId: 'b', quote: 'a b' })).toThrow('多处');
});
it('编号目录保留原句与小数，拒绝未知编号',()=>{const text='The distance is 2.5 miles. Stop if you feel pain.';const catalog=createCitationCatalog([{id:'b',text}]);expect(catalog).toHaveLength(2);expect(citation(catalog,'C1').quote).toBe('The distance is 2.5 miles.');expect(()=>citation(catalog,'C9')).toThrow('未知');});
