import{taskKinds,type GenerationContent,type GenerationTask,type GenerationMode,ServiceStopError}from'./generation-model';
export{taskSchema,ServiceStopError}from'./generation-model';
import type{Project}from'./model';
import{issues,teachingSource}from'./logic';
import{applicableSpecial,specialNames,specialFingerprint}from'./special';
function scopedJob(job:Project['job'],kind:GenerationContent):Project['job']|undefined{
 const tasks=job.tasks?.filter(t=>t.kind===kind);if(!tasks?.length)return;
 const complete=tasks.filter(t=>t.state==='complete').length,failed=tasks.some(t=>t.state==='failed');
 const state:Project['job']['state']=tasks.every(t=>t.state==='complete')?'complete':job.state==='running'&&tasks.some(t=>t.state==='running'||t.state==='pending')?'running':job.state==='cancelled'?'cancelled':failed?(complete?'partial':'failed'):complete?'partial':'interrupted';
 return structuredClone({...job,mode:kind,tasks,state,current:tasks.some(t=>t.id===job.current)?job.current:undefined,done:kind==='analysis'?tasks.filter(t=>t.state==='complete').flatMap(t=>t.questionIds):[],errors:Object.fromEntries(tasks.filter(t=>t.state==='failed').map(t=>[t.id,t.error]))});
}
export function archiveGenerationJob(p:Project){for(const kind of taskKinds){const job=scopedJob(p.job,kind);if(job){p.generationJobs??={};p.generationJobs[kind]=job;}}}
export function generationJobFor(p:Project,kind:GenerationContent){return p.job.mode===kind||p.job.mode==='selected'?scopedJob(p.job,kind)||p.generationJobs?.[kind]:p.generationJobs?.[kind]||scopedJob(p.job,kind);}
export function planSelectedGeneration(project:Project,ids:string[],kinds:GenerationContent[],resume=false):Project{
 if(!Array.isArray(kinds)||!kinds.length||kinds.some(k=>!taskKinds.includes(k))||new Set(kinds).size!==kinds.length)throw Error('请勾选至少一种有效内容，不能重复');
 let p:Project;
 if(resume){
  p=structuredClone(project);archiveGenerationJob(p);
  const jobs=kinds.map(k=>generationJobFor(p,k));
  if(jobs.some(j=>!j?.tasks?.length))throw Error('所选内容尚无上次任务，请先开始生成');
  p.job={state:'running',done:[],errors:{},mode:'selected',tasks:jobs.flatMap(j=>structuredClone(j!.tasks!))};
 }else{
  // Build explicit user-selected scopes; no implicit full-lesson generation.
  p=planGeneration(project,ids,'selected');
  p.job.tasks=p.job.tasks!.filter(t=>kinds.includes(t.kind));
  if(!p.job.tasks.length)throw Error('所选内容不适用于这些材料');
 }
 return p;
}
export function planGeneration(project:Project,ids:string[],mode:GenerationMode):Project{
 const p=structuredClone(project),qs=p.questions.filter(q=>ids.includes(q.id)&&!q.excluded);if(!qs.length)throw Error('请选择至少一道题');
 const tasks:GenerationTask[]=[];for(const q of qs){const found=issues(p,q).filter(s=>s!=='AI答案与参考答案冲突');if(!q.confirmed||found.length)throw Error('第'+q.number+'题未核对完成：'+found.join('；'));}archiveGenerationJob(p);
 for(const pid of new Set(qs.map(q=>q.passageId))){const a=p.passages.find(a=>a.id===pid);if(!a)throw Error('缺少关联材料');const group=qs.filter(q=>q.passageId===pid),source=teachingSource(p,pid);
 const add=(kind:GenerationTask['kind'],questionIds:string[],title:string,specialKind?:string)=>tasks.push({id:pid+':'+kind+':'+(specialKind||questionIds.join(',')),passageId:pid,kind,questionIds,specialKind,title:a.title+' · '+title,source,state:'pending',error:'',attempts:0});
 if(mode!=='modules')for(const q of group)add('analysis',[q.id],'第'+q.number+'题解析');
 if(mode!=='analysis'){
  if((mode==='lesson'||mode==='translation'||mode==='selected')&&a.type!=='writing')add('translation',group.map(q=>q.id),'原文译文');
  for(const q of group)add('practice',[q.id],'第'+q.number+'题同类练习');
  if(a.type!=='writing')for(const[kind,name]of[['sentences','句法拆解'],['structure','篇章脉络'],['lexicon','词汇手账'],['imitation','表达迁移']]as const)add(kind,group.map(q=>q.id),name);
  for(const kind of applicableSpecial(a.type))add('special',group.map(q=>q.id),specialNames[kind],kind);
 }
 }
 if(mode==='lesson')for(const t of tasks){const a=p.passages.find(a=>a.id===t.passageId)!,q=p.questions.find(q=>q.id===t.questionIds[0]),e=q?.versions.find(v=>v.id===q.activeVersion),v=a.learning?.versions.find(v=>v.id===a.learning?.activeVersion);
  if(t.kind==='analysis'&&e?.sourceText===t.source&&!q?.stale&&!e.conflict)t.state='complete';
  if(t.kind==='practice'&&e?.exercise&&e.sourceText===t.source&&!q?.stale&&!e.conflict)t.state='complete';
  if(t.kind==='translation'&&a.translation.trim()&&a.translationSource===t.source)t.state='complete';
  if(['sentences','structure','lexicon','imitation'].includes(t.kind)&&v?.sourceText===t.source&&!a.learning?.stale&&(!v.completedModules||v.completedModules.includes(t.kind as 'sentences'|'structure'|'lexicon'|'imitation')))t.state='complete';
  if(t.kind==='special'){const old=a.special?.versions.find(v=>v.id===a.special?.active[t.specialKind!]);if(old?.sourceText===specialFingerprint(p,a.id)&&old.result.items.length&&t.questionIds.every(id=>old.input.questionIds.includes(id)))t.state='complete';}
 }
 const selectedTasks=taskKinds.includes(mode as GenerationContent)?tasks.filter(t=>t.kind===mode):tasks;if(!selectedTasks.length)throw Error('当前选择的材料不适用这一项内容');
 p.job={state:'running',done:selectedTasks.filter(t=>t.kind==='analysis'&&t.state==='complete').flatMap(t=>t.questionIds),errors:{},mode,tasks:selectedTasks};return p;
}
export async function runGeneration(project:Project,signal:AbortSignal,execute:(p:Project,t:GenerationTask)=>Promise<Project>,save:(p:Project)=>Promise<unknown>,resume=false,progress:(p:Project,message:string)=>void=()=>{}){
 let p=structuredClone(project);if(!p.job.tasks?.length)throw Error('没有可继续的任务，请重新选择生成范围');
 const checkpoint=async()=>{archiveGenerationJob(p);await save(p);};
 if(resume)for(const t of p.job.tasks!){if(t.source!==teachingSource(p,t.passageId))throw Error('材料或答案已变化，请重新生成；不能沿用上次任务');if(t.state!=='complete'){if(t.questionIds.some(id=>!p.questions.some(q=>q.id===id&&q.confirmed&&!q.excluded)))throw Error('题目核对状态已变化，请重新选择生成范围');t.state='pending';t.error='';}}
 p.job.state='running';p.job.stopReason=undefined;await checkpoint();
 for(let i=0;i<p.job.tasks!.length;i++){
  if(signal.aborted)break;const t=p.job.tasks![i];if(t.state!=='pending')continue;
  t.state='running';t.attempts++;t.error='';delete p.job.errors[t.id];p.job.current=t.id;await checkpoint();progress(p,'正在生成：'+t.title);
  try{const next=await execute(structuredClone(p),structuredClone(t));p=next;if(signal.aborted)break;if(p.job.tasks![i].state!=='failed')p.job.tasks![i].state='complete';p.job.done=[...new Set(p.job.tasks!.filter(t=>t.kind==='analysis'&&t.state==='complete').flatMap(t=>t.questionIds))];}
  catch(error){const current=p.job.tasks![i];if(signal.aborted){current.state='pending';break;}current.state='failed';current.error=error instanceof Error?error.message:String(error);p.job.errors[t.id]=current.error;if(error instanceof ServiceStopError){p.job.stopReason=current.error;await checkpoint();break;}}
  await checkpoint();progress(p,p.job.tasks![i].state==='failed'?'此项失败，继续后续内容：'+t.title:'已保存：'+t.title);if(p.job.stopReason)break;
 }
 for(const t of p.job.tasks!)if(t.state==='running')t.state='pending';
 const complete=p.job.tasks!.filter(t=>t.state==='complete').length;
 p.job.done=[...new Set(p.job.tasks!.filter(t=>t.kind==='analysis'&&t.state==='complete').flatMap(t=>t.questionIds))];
 p.job.errors=Object.fromEntries(p.job.tasks!.filter(t=>t.state==='failed').map(t=>[t.id,t.error]));p.job.state=signal.aborted?'cancelled':p.job.tasks!.every(t=>t.state==='complete')?'complete':complete?'partial':'failed';p.job.current=undefined;await checkpoint();const firstFailure=p.job.tasks!.find(t=>t.state==='failed');progress(p,p.job.state==='complete'?'所选内容生成完成':signal.aborted?'本项已取消，已完成内容已保存':firstFailure?'未完成：'+firstFailure.title+'。'+firstFailure.error:'本项尚未完成，请查看逐项进度');return p;
}
