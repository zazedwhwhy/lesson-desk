import {chemChecks,chemReady,chemModules,chemNames,type Chemistry,type ChemQuestion,type ChemModule} from './chemistry';
import type {ReviewAction} from './review';
export const chemQuestionIssues=(q:ChemQuestion)=>chemChecks({...q,confirmed:true});
export function applyChemReviewBatch(original:Chemistry,ids:string[],action:ReviewAction){
 if(!ids.length||ids.some(id=>!original.questions.some(q=>q.id===id)))throw Error('请重新选择有效题目');
 const data=structuredClone(original),skipped:string[]=[];let changed=0;
 for(const q of data.questions.filter(q=>ids.includes(q.id))){
  const before=[q.confirmed,q.excluded].join();
  if(action==='confirm'){const issues=chemQuestionIssues(q);if(issues.length){skipped.push('第 '+q.number+' 题：'+issues.join('；'));continue;}q.confirmed=true;}
  else if(action==='unconfirm')q.confirmed=false;
  else if(action==='exclude'){q.excluded=true;q.confirmed=false;}
  else if(action==='restore'&&q.excluded){q.excluded=false;q.confirmed=false;}
  if(before!==[q.confirmed,q.excluded].join())changed++;
 }
 return {data,changed,skipped};
}
function archive(d:Chemistry){d.history.push({at:new Date().toISOString(),questions:structuredClone(d.questions)});}
export function splitChemQuestion(d:Chemistry,id:string,newId:string){
 const index=d.questions.findIndex(q=>q.id===id);if(index<0)throw Error('题目已不存在');
 const q=d.questions[index];let number=q.number+'b';while(d.questions.some(q=>q.number===number))number+='b';
 archive(d);q.confirmed=false;d.questions.splice(index+1,0,{...structuredClone(q),id:newId,number,answer:'',versions:[],confirmed:false});
}
export function mergeChemQuestion(d:Chemistry,id:string){
 const index=d.questions.findIndex(q=>q.id===id),q=d.questions[index],next=d.questions[index+1];if(!q||!next)throw Error('没有下一题');if(q.sourceId!==next.sourceId)throw Error('两题来源不同，请保留独立题目以免混淆出处');
 const images=[...q.images,...next.images.filter(i=>!q.images.some(j=>j.id===i.id))];if(images.length>12)throw Error('合并后超过12张题图，请先整理配图');
 archive(d);q.stem+='\n'+next.stem;q.options.push(...next.options);q.answer=[q.answer,next.answer].filter(Boolean).join('；');q.images=images;q.pages=[...new Set([...q.pages,...next.pages])];q.confirmed=false;d.questions.splice(index+1,1);
}
export type ChemLessonModule='source'|ChemModule;
export type ChemSelection={questionIds:string[];modules:Record<string,ChemLessonModule[]>};
export const chemLessonNames={source:'题面与原图',...chemNames};
export const latestChemVersion=(q:ChemQuestion,m:ChemModule)=>q.versions.filter(v=>v.module===m).at(-1);
export const availableChemVersion=(q:ChemQuestion,m:ChemModule)=>q.versions.filter(v=>v.module===m&&chemReady(q,v)).at(-1);
export function chemLessonReason(q:ChemQuestion,m:ChemLessonModule){const issues=chemChecks(q);return issues.length?issues.join('；'):m==='source'||availableChemVersion(q,m)?null:'没有已确认且有效的讲义';}
export function defaultChemSelection(d:Chemistry):ChemSelection{
 const qs=d.questions.filter(q=>!chemChecks(q).length);return {questionIds:qs.map(q=>q.id),modules:Object.fromEntries(qs.map(q=>[q.id,['source',...chemModules.filter(m=>availableChemVersion(q,m))]]))};
}
export function resolveChemSelection(d:Chemistry,s:ChemSelection){
 const ids:string[]=[],issues:string[]=[];
 for(const id of s.questionIds){const q=d.questions.find(q=>q.id===id);if(!q){issues.push('所选题目已不存在');continue;}
  for(const m of s.modules[id]||[]){const reason=chemLessonReason(q,m);if(reason){issues.push('第 '+q.number+' 题 · '+chemLessonNames[m]+'：'+reason);continue;}ids.push(m==='source'?'question:'+id:availableChemVersion(q,m)!.id);}
 }
 if(!ids.length&&!issues.length)issues.push('请至少选择一项有效内容');return {ids:[...new Set(ids)],issues};
}
