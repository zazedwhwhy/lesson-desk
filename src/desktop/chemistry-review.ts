import {callAI} from './ai';
import {chemistryReviewSchema} from '../core/chemistry';
import {chemistryReviewSnapshot} from '../core/chemistry-review';
import {assertOcrReviewed} from '../core/source-fidelity';
import {chemistrySystem,chemistryReviewInstruction} from '../core/chemistry-prompts';
import type {Project,Settings} from '../core/model';
export async function reviewChemistry(p:Project,s:Settings,key:string,signal:AbortSignal,onStatus:(message:string)=>void=()=>{}){
 if(p.subject!=='chemistry'||!p.chemistry?.questions.length)throw Error('请先整理化学试卷');
 if(p.sources.some(s=>s.ocrPages?.length))throw Error('请先完成扫描页识别');
 assertOcrReviewed(p.sources);
 const next=structuredClone(p),questions=p.chemistry.questions;
 const result={coverage:'complete' as 'complete'|'partial',checkedQuestionIds:[] as string[],limitations:[] as string[],findings:[] as {questionId:string;message:string}[]};
 for(let start=0;start<questions.length;start+=3){
  const batch=questions.slice(start,start+3);onStatus(`化学校对：第 ${start+1}–${start+batch.length}/${questions.length} 项`);
  const sources=p.sources.filter(source=>source.role==='answer'||batch.some(q=>q.sourceId===source.id)).map(source=>({id:source.id,name:source.name,role:source.role,blocks:source.role==='answer'?source.blocks:source.blocks.filter(b=>batch.some(q=>q.sourceId===source.id&&(!q.pages.length||b.page===undefined||q.pages.includes(b.page))))}));
  const out=await callAI(s,key,chemistryReviewSchema,chemistryReviewInstruction+'\n输入材料：'+JSON.stringify({sources,questions:batch.map(({versions,images,...q})=>({...q,images:images.map(({data,...image})=>({...image,hasImage:true}))}))}),signal,onStatus,chemistrySystem);
  const ids=new Set(batch.map(q=>q.id));
  if(out.checkedQuestionIds.some(id=>!ids.has(id))||new Set(out.checkedQuestionIds).size!==out.checkedQuestionIds.length||out.findings.some(f=>!ids.has(f.questionId)))throw Error('校对报告关联了不属于本批的题目，保留旧报告');
  if(out.coverage==='complete'&&batch.some(q=>!out.checkedQuestionIds.includes(q.id)))throw Error('校对遗漏题目，不能标记全部检查；保留旧报告');
  result.checkedQuestionIds.push(...out.checkedQuestionIds);result.findings.push(...out.findings);result.limitations.push(...out.limitations);
  if(out.coverage==='partial')result.coverage='partial';
  const unbound=batch.filter(q=>!sources.some(source=>source.role==='paper'&&source.id===q.sourceId&&source.blocks.length));
  if(unbound.length){result.coverage='partial';result.limitations.push(`第 ${unbound.map(q=>q.number).join('、')} 题未关联可核对的原卷文字，不能确认原题一致性。`);}
 }
 if(signal.aborted)throw Error('校对已取消，保留旧报告');
 // This path reads text only. Graphs and structural formulas in PDFs require
 // an explicit visual review even when the model reports complete coverage.
 if(p.sources.some(s=>s.kind!=='text')||questions.some(q=>q.images.length)){
  result.coverage='partial';result.limitations.push('本次为文字校对，PDF/Word中的题图、结构式和公式版面尚未逐图核验，请对照原页或先按原页识别。');
 }
 result.limitations=[...new Set(result.limitations)];
 next.chemistry!.review={snapshot:chemistryReviewSnapshot(p),result};return next;
}
