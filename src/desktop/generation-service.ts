import {translationInstruction,blueprintInstruction} from '../core/request-instructions';
import {GenerationContentError} from '../core/errors';
import{z}from'zod';
import{type GenerationTask,ServiceStopError}from'../core/generation-model';
import{generateGroup,callAI}from'./ai';
import{generateIndependentExercises}from'./exercises';
import{generateTeachingPart,commitTeachingModule}from'./teaching-parts';
import{generateSpecial}from'./special';
import{exerciseBlueprintSchema,exerciseText,exerciseAnswerText}from'../core/exercise';
import{transferFromExercise}from'../core/learning';
import{active,uid,type Project,type Settings}from'../core/model';
import{specialKinds,type SpecialKind}from'../core/special';
export function generationExecutor(settings:Settings,key:string,signal:AbortSignal,onRetry:(p:Project,message:string)=>void){return async function execute(p:Project,t:GenerationTask):Promise<Project>{
 const a=p.passages.find(a=>a.id===t.passageId)!;
 if(t.kind==='translation'){const out=await callAI(settings,key,z.object({translation:z.string().min(1)}),translationInstruction+"\n"+JSON.stringify(a.paragraphs),signal,m=>onRetry(p,m));const target=p.passages.find(a2=>a2.id===a.id)!;target.translation=out.translation;target.translationSource=t.source;return p;}
 if(t.kind==='analysis'){
  const batch=p.job.tasks!.filter(x=>x.kind==='analysis'&&x.passageId===t.passageId&&(x.state==='pending'||x.id===t.id)).slice(0,4),ids=batch.flatMap(x=>x.questionIds);
  let next:Project;
  try{next=await generateGroup(p,t.passageId,ids,settings,key,signal,m=>onRetry(p,m));}
  catch(error){
   if(signal.aborted||error instanceof ServiceStopError)throw error;
   next=structuredClone(p);
   for(const b of batch){const failed=next.job.tasks!.find(x=>x.id===b.id)!;failed.state='failed';failed.error=error instanceof Error?error.message:String(error);next.job.errors[b.id]=failed.error;}
  }
  for(const b of batch){const task=next.job.tasks!.find(x=>x.id===b.id)!;if(b.id!==t.id)task.attempts++;}
  let repaired=next;for(const failed of batch.filter(b=>next.job.tasks!.find(x=>x.id===b.id)!.state==='failed')){
   onRetry(repaired,failed.title+'校验失败，AI正在单题修正（1/1）');
   try{repaired=await generateGroup(repaired,t.passageId,failed.questionIds,settings,key,signal,m=>onRetry(repaired,m),false,repaired.job.tasks!.find(x=>x.id===failed.id)!.error);}
   catch(error){const task=repaired.job.tasks!.find(x=>x.id===failed.id)!;if(signal.aborted){task.state='pending';task.error='';delete repaired.job.errors[task.id];break;}task.state='failed';task.error=error instanceof Error?error.message:String(error);repaired.job.errors[task.id]=task.error;if(error instanceof ServiceStopError){repaired.job.stopReason=task.error;break;}}
  }return repaired;
 }
 if(t.kind==='practice'){
  const q=p.questions.find(q=>q.id===t.questionIds[0])!,e=active(q);
  let blueprint=!q.stale&&e?.sourceText===t.source?e?.practiceBlueprint:undefined;
  if(!blueprint){blueprint=await callAI(settings,key,exerciseBlueprintSchema,blueprintInstruction+"\n"+JSON.stringify({type:q.type,stem:q.stem,options:q.options,referenceAnswer:q.answer,passage:a.paragraphs}),signal,m=>onRetry(p,m));if(blueprint.kind!==q.type)throw Error('同类练习蓝图题型不一致');}
  const sourceTexts=[...a.paragraphs.map(b=>b.text),a.pool,q.stem,...q.options];let feedback='';
  for(let attempt=0;attempt<2;attempt++)try{
   const items=await generateIndependentExercises([{id:q.id,blueprint}],settings,key,signal,sourceTexts,m=>onRetry(p,m),feedback,p.questions.findIndex(q2=>q2.id===q.id)),exercise=items[0].exercise;
   const next=structuredClone(p),target=next.questions.find(q2=>q2.id===q.id)!;if(e&&!q.stale){const v={...e,id:uid(),createdAt:new Date().toISOString(),origin:'ai' as const,exercise,practice:exerciseText(exercise),practiceAnswer:exerciseAnswerText(exercise),practiceBlueprint:blueprint};target.versions.push(v);target.activeVersion=v.id;}
   const pa=next.passages.find(a2=>a2.id===a.id)!,current=pa.learning?.versions.find(v=>v.id===pa.learning?.activeVersion),old=current?.sourceText===t.source&&!pa.learning?.stale?current.data.transfer:[];
   return commitTeachingModule(next,a.id,'transfer',[...old.filter(x=>x.questionId!==q.id),{...transferFromExercise(exercise),questionId:q.id}]);
  }catch(error){if(signal.aborted||error instanceof ServiceStopError||attempt===1||!(error instanceof GenerationContentError||error instanceof z.ZodError))throw error;feedback=error instanceof Error?error.message:String(error);onRetry(p,'第'+q.number+'题练习正在由AI修正（1/1）');}
  throw Error('同类练习修正失败');
 }
 if(t.kind==='special'){
  if(!specialKinds.includes(t.specialKind as SpecialKind))throw Error('专项类型无效');const text=p.questions.filter(q=>t.questionIds.includes(q.id)).map(q=>q.stem).join('\n');
  const old=a.special?.versions.find(v=>v.id===a.special?.active[t.specialKind!]);
  const opening=(n:number)=>text.match(new RegExp('Paragraph\\s*'+n+'\\s*[:：]\\s*([^\\n]+)','i'))?.[1]?.trim()||'';
  const input={material_complete:false,extra:'',opening1:opening(1),opening2:opening(2),questionIds:t.questionIds};
  if(t.specialKind==='continuation'&&old){if(!input.opening1&&text.includes(old.input.opening1))input.opening1=old.input.opening1;if(!input.opening2&&text.includes(old.input.opening2))input.opening2=old.input.opening2;}
  const next=await generateSpecial(p,a.id,t.specialKind as SpecialKind,input,settings,key,signal),result=next.passages.find(a2=>a2.id===a.id)!.special!.versions.at(-1)!.result;
  if(!result.items.length)throw Error('专项未生成可用内容：'+result.notices.join('；'));return next;
 }
 return generateTeachingPart(p,a.id,t.kind,t.questionIds,settings,key,signal,m=>onRetry(p,m));
};}
