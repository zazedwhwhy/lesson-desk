import {z} from 'zod';
import {uid,type Source} from './model';
export const manualOcrSchema=z.object({sourceId:z.string().min(1),pages:z.array(z.number().int().min(1).max(100)).min(1).max(100)});
export function pdfPageCount(source:Source){return source.pageCount||Math.max(0,...source.blocks.map(b=>b.page||0),...(source.ocrPages||[]),...(source.ocrReviewPages||[]),...(source.ocrVerifiedPages||[]),...(source.ocrTranscriptions||[]).map(p=>p.page),...(source.ocrCorrections||[]).map(p=>p.page));}
export function parseOcrPages(value:string,total:number){
 if(!Number.isInteger(total)||total<1||total>100)throw Error('无法确定PDF页数，请重新上传原PDF');
 if(!value.trim())return Array.from({length:total},(_,i)=>i+1);
 const pages=new Set<number>();
 for(const part of value.split(/[,，、\s]+/).filter(Boolean)){
  const m=part.match(/^(\d+)(?:[-~～至](\d+))?$/);if(!m)throw Error('页码格式示例：1,3-5');
  const from=Number(m[1]),to=Number(m[2]||m[1]);if(from<1||to<from||to>total)throw Error(`页码须在1至${total}之间，范围不能倒序`);
  for(let n=from;n<=to;n++)pages.add(n);
 }
 return [...pages].sort((a,b)=>a-b);
}
export function queueManualOcr(sources:Source[],raw:unknown){
 const request=manualOcrSchema.parse(raw),source=sources.find(s=>s.id===request.sourceId);
 if(!source||source.kind!=='pdf'||!source.asset)throw Error('请选择带原文件的PDF材料');
 if(request.pages.some(n=>n>pdfPageCount(source)))throw Error('识别页码超出原PDF范围');
 source.ocrPages=[...new Set([...(source.ocrPages||[]),...request.pages])].sort((a,b)=>a-b);
 return {source,pages:[...new Set(request.pages)].sort((a,b)=>a-b)};
}
export function applyRecognizedPage(source:Source,page:number,result:{blank:boolean;blocks:string[];uncertain:string[]}){
 if(!result.blank&&!result.blocks.some(t=>t.trim()))throw Error(`第${page}页未识别出文字，原文字已保留，请重试`);
 const before=structuredClone(source.blocks.filter(b=>b.page===page));
 const after=result.blocks.filter(t=>t.trim()).map(text=>({id:uid(),text,page}));
 const at=new Date().toISOString();
 if(before.length){source.ocrCorrections??=[];source.ocrCorrections.push({page,at,before,after:structuredClone(after)});}
 source.ocrTranscriptions??=[];source.ocrTranscriptions.push({page,at,blocks:result.blocks,uncertain:result.uncertain});
 source.ocrReviewPages=[...new Set([...(source.ocrReviewPages||[]),page])];
 source.ocrVerifiedPages=(source.ocrVerifiedPages||[]).filter(p=>p!==page);
 source.blocks=[...source.blocks.filter(b=>b.page!==page),...after].sort((a,b)=>(a.page||0)-(b.page||0));
 source.ocrPages=(source.ocrPages||[]).filter(p=>p!==page);
 source.warnings=[...(source.warnings||[]),`第${page}页经AI识别，须核对题号、公式和答案。`,...result.uncertain.map(t=>`第${page}页待核实：${t}`)];
}
