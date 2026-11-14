import {assertOcrReviewed,protectChemistry} from '../core/source-fidelity';
import {preserveFailure} from './diagnostics';
import {z} from 'zod';
import {callAI} from './ai';
import {ServiceStopError} from '../core/generation-model';
import {GenerationContentError} from '../core/errors';
import {validChemPractice,chemQuestionSchema,chemResultSchema,chemChecks,chemFingerprint,chemModules,chemNames,type ChemModule,type ChemResult,type ChemQuestion} from '../core/chemistry';
import {uid,type Project,type Settings} from '../core/model';

import {chemistrySystem as system,chemInstructions,chemistryOrganizeInstruction} from '../core/chemistry-prompts';
const organized=z.object({questions:z.array(z.object({number:z.string().min(1),kind:chemQuestionSchema.shape.kind,stem:z.string().min(1),options:z.array(z.string()),answer:z.string(),sourceId:z.string(),pages:z.array(z.number().int().positive())})).min(1)});
export async function organizeChemistry(p:Project,s:Settings,key:string,signal:AbortSignal){
 if(p.subject!=='chemistry'||!p.chemistry)throw Error('请选择化学课件');
 assertOcrReviewed(p.sources);
 const out=await callAI(s,key,organized,chemistryOrganizeInstruction+'\n输入材料：'+JSON.stringify(p.sources.map(({id,name,role,blocks})=>({id,name,role,blocks}))),signal,undefined,system,[],32768);
 try{if(signal.aborted)throw Error('已取消整理，原题目未替换');
 const numbers=new Set<string>();
 for(const q of out.questions){
  const source=p.sources.find(s=>s.id===q.sourceId&&s.role==='paper');
  if(!source||numbers.has(q.number))throw Error('整理结果的来源或题号无效，原题目未替换');
  if(q.pages.some(page=>!source.blocks.some(b=>b.page===page)))throw Error('整理结果页码不在来源中，原题目未替换');
  numbers.add(q.number);
 }
 protectChemistry(p,out);
 const next=structuredClone(p);if(next.chemistry!.questions.length)next.chemistry!.history.push({at:new Date().toISOString(),questions:next.chemistry!.questions});
 next.chemistry!.questions=out.questions.map(q=>chemQuestionSchema.parse({...q,id:uid()}));next.chemistry!.tasks=[];
 return next;
 }catch(error){return preserveFailure(error,{stage:'organize-validation',projectId:p.id,model:s.model,subject:p.subject,candidate:out});}
}
export type ChemCaller=(q:ChemQuestion,module:ChemModule,signal:AbortSignal)=>Promise<ChemResult>;
export function chemistryCaller(s:Settings,key:string):ChemCaller{return async(q,module,signal)=>{
 const images=q.imageMode==='vision'?q.images.map(i=>i.data):[];
 const prompt=chemInstructions[module]+'\n输入材料：'+JSON.stringify({stage:q.stage,number:q.number,kind:q.kind,stem:q.stem,options:q.options,answer:q.answer,figures:q.images.map(i=>({name:i.name,page:i.page,description:i.description})),imageMode:q.imageMode});
 return callAI(s,key,chemResultSchema,prompt,signal,undefined,system,images);
};}
export async function generateChemistry(p:Project,ids:string[],modules:ChemModule[],signal:AbortSignal,save:(p:Project,message:string)=>Promise<void>,call:ChemCaller,resume=false){
 if(p.subject!=='chemistry'||!p.chemistry)throw Error('请选择化学课件');
 if(!ids.length||!modules.length||new Set(ids).size!==ids.length||new Set(modules).size!==modules.length||modules.some(m=>!chemModules.includes(m)))throw Error('请选择题目和有效模块');
 const next=structuredClone(p),d=next.chemistry!;
 for(const id of ids){const q=d.questions.find(q=>q.id===id);if(!q)throw Error('题目已不存在');const issues=chemChecks(q);if(issues.length)throw Error('第 '+q.number+' 题：'+issues.join('；'));}
 const selected=d.questions.filter(q=>ids.includes(q.id));
 const tasks:NonNullable<Project['chemistry']>['tasks']=selected.flatMap(q=>modules.map(module=>{
  const prev=d.tasks.find(t=>t.questionId===q.id&&t.module===module&&t.fingerprint===chemFingerprint(q));
  return resume&&prev?{...prev,state:prev.state==='running'?'pending' as const:prev.state}:{id:uid(),questionId:q.id,module,fingerprint:chemFingerprint(q),state:'pending' as const,error:'',attempts:0};
 }));
 d.tasks=[...d.tasks.filter(t=>!ids.includes(t.questionId)||!modules.includes(t.module)),...tasks];
 await save(next,'已建立化学生成任务');
 for(const task of tasks){
  if(resume&&task.state==='complete')continue;
  if(signal.aborted)break;
  const q=d.questions.find(q=>q.id===task.questionId)!;
  task.state='running';task.error='';task.attempts++;
  await save(next,'正在生成第 '+q.number+' 题 · '+chemNames[task.module]);
  let result:ChemResult;
  try{
   result=chemResultSchema.parse(await call(q,task.module,signal));
   if(signal.aborted)throw Error('已取消，本项结果未保存');
   if(task.module==='practice'&&result.status==='ok'&&!validChemPractice(result))throw new GenerationContentError('考点演练缺少独立题目、答案或解析，未保存');
  }catch(error){
   task.state=signal.aborted?'pending':'failed';task.error=error instanceof Error?error.message:String(error);
   await save(next,'第 '+q.number+' 题 · '+chemNames[task.module]+'：'+task.error);
   if(signal.aborted||error instanceof ServiceStopError||!(error instanceof GenerationContentError||error instanceof z.ZodError))break;
   continue;
  }
  q.versions.push({id:uid(),module:task.module,createdAt:new Date().toISOString(),origin:'ai',fingerprint:task.fingerprint,confirmed:false,result});
  task.state=result.status==='ok'?'complete':'failed';task.error=result.status==='ok'?'':'待核实：'+result.notices.join('；');
  // Persistence errors must stop here; never reclassify them as AI content errors.
  await save(next,'已保存第 '+q.number+' 题 · '+chemNames[task.module]+(task.error?'（待核实）':''));
 }
 await save(next,signal.aborted?'已取消，已完成结果保留':'化学生成结束，请核对讲义与未完成任务');
 return next;
}
