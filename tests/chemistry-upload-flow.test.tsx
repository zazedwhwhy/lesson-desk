import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {emptyProject} from '../src/core/model';
import {SourceMaterials} from '../src/ui/SourceMaterials';
import {queueChemistryPdf,applyRecognizedPage} from '../src/core/manual-ocr';
import {applyOcrReview} from '../src/core/ocr-review';
it('化学文字PDF上传后在上传按钮同一行直接显示AI识别',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'试卷',role:'paper',kind:'pdf',asset:'sources/s.pdf',blocks:[{id:'b',text:'已有文字层',page:1}],ocrPages:[]}];
 const html=renderToStaticMarkup(<SourceMaterials project={p} sourceId="s" setSourceId={()=>{}} paste="" setPaste={()=>{}} busy={false} change={async()=>{}} run={async fn=>fn()} task={async()=>{}}/>);
 const toolbar=html.slice(0,html.indexOf('</div>'));
 expect(toolbar).toContain('上传试卷');expect(toolbar).toContain('上传答案');expect(toolbar).toMatch(/<button[^>]*>[\s\S]*AI识别<\/button>/);expect(toolbar).not.toContain('<details');
});
it('化学PDF上传后所有页待识别，识别后待核对且保留已有文字和讲评',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'卷',kind:'pdf',role:'paper',asset:'sources/s.pdf',pageCount:2,blocks:[{id:'b1',page:1,text:'旧文字1'},{id:'b2',page:2,text:'旧文字2'}]}];
 const before=structuredClone(p),s=p.sources[0];queueChemistryPdf(s);expect(s.ocrPages).toEqual([1,2]);expect(s.blocks).toEqual(before.sources[0].blocks);
 applyRecognizedPage(s,1,{blank:false,blocks:['原页识别结果1'],uncertain:[]});expect(s.ocrPages).toEqual([2]);expect(s.ocrReviewPages).toEqual([1]);
 applyRecognizedPage(s,2,{blank:false,blocks:['原页识别结果2'],uncertain:[]});
 const reviewed=applyOcrReview(p,{kind:'verify',pages:[1,2].map(page=>({sourceId:'s',page,expectedBlocks:s.blocks.filter(b=>b.page===page)}))});
 expect(reviewed.sources[0].ocrVerifiedPages).toEqual([1,2]);expect(reviewed.chemistry).toEqual(before.chemistry);
});
