import {expect,it} from 'vitest';
import {emptyProject,type Source} from '../src/core/model';
import {applyRecognizedPage,parseOcrPages,queueManualOcr,pdfPageCount} from '../src/core/manual-ocr';
import {applyOcrReview} from '../src/core/ocr-review';
const source=():Source=>({id:'s',name:'卷',kind:'pdf',role:'paper',asset:'sources/s.pdf',pageCount:3,ocrPages:[],ocrVerifiedPages:[1],blocks:[{id:'one',page:1,text:'原公式SO₄²⁻'},{id:'two',page:2,text:'第二页不改动'}]});
it('页码选择支持整份/范围，拒绝越界、倒序与无效输入',()=>{
 expect(parseOcrPages('',3)).toEqual([1,2,3]);expect(parseOcrPages('1,2-3,2',3)).toEqual([1,2,3]);
 for(const value of ['0','4','3-1','x'])expect(()=>parseOcrPages(value,3)).toThrow();
});
it('旧PDF末页识别为空白后仍可再次选择该页',()=>{
 const s=source();delete s.pageCount;s.blocks=[s.blocks[0]];s.ocrReviewPages=[2];s.ocrTranscriptions=[{page:3,at:'before',blocks:[],uncertain:[]}];expect(pdfPageCount(s)).toBe(3);expect(queueManualOcr([s],{sourceId:'s',pages:[3]}).pages).toEqual([3]);
});
it('手动识别只排队选中页，提交结果前不删除原文字',()=>{
 const s=source(),before=structuredClone(s.blocks);expect(queueManualOcr([s],{sourceId:'s',pages:[1,3]}).pages).toEqual([1,3]);expect(s.blocks).toEqual(before);
 expect(()=>queueManualOcr([s],{sourceId:'s',pages:[4]})).toThrow();
 expect(()=>applyRecognizedPage(s,1,{blank:false,blocks:[],uncertain:[]})).toThrow();expect(s.blocks).toEqual(before);
});
it('重新识别保留原文字，可逐页恢复，不改其他页或教师讲评',()=>{
 const p=emptyProject('化学','chemistry'),s=source();p.sources=[s];const before=structuredClone(s.blocks),teaching=structuredClone(p.chemistry);
 queueManualOcr(p.sources,{sourceId:'s',pages:[1]});applyRecognizedPage(s,1,{blank:false,blocks:['待核对的新转录'],uncertain:['电荷需核对']});
 expect(s.ocrCorrections?.[0].before).toEqual([before[0]]);expect(s.ocrVerifiedPages).toEqual([]);expect(s.ocrReviewPages).toContain(1);
 const restored=applyOcrReview(p,{kind:'restore',page:{sourceId:'s',page:1,expectedBlocks:s.blocks.filter(b=>b.page===1)}});
 expect(restored.sources[0].blocks).toEqual(before);expect(restored.chemistry).toEqual(teaching);expect(restored.sources[0].ocrReviewPages).toContain(1);
 expect(()=>applyOcrReview(restored,{kind:'restore',page:{sourceId:'s',page:1,expectedBlocks:s.blocks.filter(b=>b.page===1)}})).toThrow(/内容已变化/);
});
