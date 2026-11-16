import type {Project} from '../core/model';
import type {GenerationTask} from '../core/generation-model';
import {ServiceStopError} from '../core/generation-model';
import {archiveGenerationJob} from '../core/generation';
import {teachingSource} from '../core/logic';
import {taskPool,serialSnapshots} from '../core/task-pool';
import {phaseFor} from '../core/task-timing';
import {commitTeachingModule} from './teaching-parts';

// Commit only the task's owned output, never replace the current project with
// the older snapshot used to make its network request.
export function mergeTaskResult(current:Project,result:Project,t:GenerationTask):Project{
 let next=structuredClone(current);
 const source=result.passages.find(a=>a.id===t.passageId)!,target=next.passages.find(a=>a.id===t.passageId)!;
 if(t.kind==='translation'){target.translation=source.translation;target.translationSource=source.translationSource;}
 if(t.kind==='analysis'||t.kind==='practice')for(const id of t.questionIds){
  const from=result.questions.find(q=>q.id===id)!,to=next.questions.find(q=>q.id===id)!;
  const added=from.versions.filter(v=>!to.versions.some(old=>old.id===v.id));
  to.versions.push(...added);if(added.length){to.activeVersion=from.activeVersion;to.stale=from.stale;}
 }
 if(t.kind==='special'&&source.special){
  target.special??=structuredClone(source.special);
  for(const v of source.special.versions)if(!target.special.versions.some(old=>old.id===v.id))target.special.versions.push(structuredClone(v));
  if(t.specialKind)target.special.active[t.specialKind]=source.special.active[t.specialKind];
 }
 const module=t.kind==='practice'?'transfer':t.kind;
 if(['sentences','structure','lexicon','imitation','transfer'].includes(module)){
  const version=source.learning?.versions.find(v=>v.id===source.learning?.activeVersion);
  if(version){const key=module as 'sentences'|'structure'|'lexicon'|'imitation'|'transfer';let value=version.data[key];
   if(key==='transfer'){const old=target.learning?.versions.find(v=>v.id===target.learning?.activeVersion)?.data.transfer||[];value=[...old.filter(v=>!t.questionIds.includes(v.questionId||'')),...version.data.transfer.filter(v=>t.questionIds.includes(v.questionId||''))];}
   next=commitTeachingModule(next,t.passageId,key,value);
  }
 }
 return next;
}
export async function runParallelGeneration(project:Project,signal:AbortSignal,execute:(p:Project,t:GenerationTask,status?:(message:string)=>void)=>Promise<Project>,save:(p:Project)=>Promise<unknown>,resume=false,progress:(p:Project,message:string)=>void=()=>{}){
 let p=structuredClone(project);if(!p.job.tasks?.length)throw Error('没有可继续的任务');
 if(resume)for(const t of p.job.tasks){if(t.source!==teachingSource(p,t.passageId)||t.questionIds.some(id=>!p.questions.some(q=>q.id===id&&q.confirmed&&!q.excluded)))throw Error('材料或核对状态已变化，请重新选择生成');if(t.state!=='complete'){t.state='pending';t.error='';}}
 p.job.state='running';p.job.stopReason=undefined;
 const persist=serialSnapshots<Project>(async(value,message)=>{await save(value);progress(value,message);});
 const checkpoint=(message:string)=>{archiveGenerationJob(p);return persist(p,message);};
 await checkpoint('开始并行生成，最多同时处理3项');
 // Resume scopes may list practice before analysis. Dispatch prerequisites
 // first so waiting dependants cannot occupy every worker slot.
 const items=p.job.tasks.filter(t=>t.state==='pending').sort((a,b)=>Number(b.kind==='analysis')-Number(a.kind==='analysis'));
 const dependencies=new Map<string,Promise<void>>();
 const done=new Map<string,()=>void>();
 for(const t of items)dependencies.set(t.id,new Promise(resolve=>done.set(t.id,resolve)));
 await taskPool(items,async entry=>{
  try{
   if(entry.kind==='practice')await Promise.all(items.filter(t=>t.kind==='analysis'&&t.questionIds.some(id=>entry.questionIds.includes(id))).map(t=>dependencies.get(t.id)!));
   if(signal.aborted||p.job.stopReason)return;
   let t=p.job.tasks!.find(t=>t.id===entry.id)!;t.state='running';t.attempts++;t.error='';t.startedAt=Date.now();delete t.finishedAt;t.phase='generating';
   await checkpoint('正在生成：'+t.title);
   if(signal.aborted||p.job.stopReason){p.job.tasks!.find(x=>x.id===entry.id)!.state='pending';return;}
   const status=(message:string)=>{const live=p.job.tasks!.find(x=>x.id===entry.id)!;live.phase=phaseFor(message);progress(structuredClone(p),message);};
   try{
    const snapshot=structuredClone(p);
    // Each worker owns one analysis task; do not claim another worker's work.
    snapshot.job.tasks=snapshot.job.tasks!.filter(x=>x.id===t.id);
    const result=await execute(snapshot,structuredClone(t),status);
    if(signal.aborted){t=p.job.tasks!.find(x=>x.id===entry.id)!;t.state='pending';}
    else{p=mergeTaskResult(p,result,t);t=p.job.tasks!.find(x=>x.id===entry.id)!;const outcome=result.job.tasks?.find(x=>x.id===t.id);t.state=outcome?.state==='failed'?'failed':'complete';t.error=outcome?.error||'';if(result.job.stopReason)p.job.stopReason=result.job.stopReason;}
   }catch(error){t=p.job.tasks!.find(x=>x.id===entry.id)!;t.state=signal.aborted?'pending':'failed';t.error=error instanceof Error?error.message:String(error);if(error instanceof ServiceStopError)p.job.stopReason=t.error;}
   t.finishedAt=Date.now();t.phase='saving';
   p.job.done=p.job.tasks!.filter(x=>x.kind==='analysis'&&x.state==='complete').flatMap(x=>x.questionIds);
   await checkpoint(t.state==='complete'?'已保存：'+t.title:'本项未完成：'+t.title);
  }finally{done.get(entry.id)!();}
 },()=>signal.aborted||!!p.job.stopReason);
 for(const t of p.job.tasks!)if(t.state==='running')t.state='pending';
 p.job.errors=Object.fromEntries(p.job.tasks!.filter(t=>t.state==='failed').map(t=>[t.id,t.error]));
 p.job.state=signal.aborted?'cancelled':p.job.tasks!.every(t=>t.state==='complete')?'complete':p.job.tasks!.some(t=>t.state==='complete')?'partial':'failed';p.job.current=undefined;
 await checkpoint('本次并行生成结束，已保存内容保留');return p;
}
