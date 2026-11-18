import {isContentError} from '../core/errors';
import type {Project} from '../core/model';
import type {GenerationTask} from '../core/generation-model';
import {ServiceStopError} from '../core/generation-model';
import {archiveGenerationJob} from '../core/generation';
import {issues,teachingSource} from '../core/logic';
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
export async function runParallelGeneration(project:Project,signal:AbortSignal,execute:(p:Project,t:GenerationTask,status:(message:string)=>void)=>Promise<Project>,save:(p:Project)=>Promise<unknown>,resume=false,progress:(p:Project,message:string)=>void=()=>{}){
 let p=structuredClone(project);if(!p.job.tasks?.length)throw Error('没有可继续的任务');
 if(resume)for(const task of p.job.tasks){
  if(task.source!==teachingSource(p,task.passageId))throw Error('材料已变化，请重新选择生成');
  for(const id of task.questionIds){
   const q=p.questions.find(q=>q.id===id);
   if(!q?.confirmed||q.excluded)throw Error('题目核对状态已变化，请重新选择生成');
   const problems=issues(p,q).filter(issue=>issue!=='AI答案与参考答案冲突');
   if(problems.length)throw Error('第'+q.number+'题：'+problems.join('；'));
  }
  if(task.state!=='complete'){task.state='pending';task.error='';}
 }
 p.job.state='running';p.job.stopReason=undefined;
 const persist=serialSnapshots<Project>(async(value,message)=>{await save(value);progress(value,message);});
 const checkpoint=(message:string)=>{archiveGenerationJob(p);return persist(p,message);};
 await checkpoint('开始并行生成，最多同时处理3项');
 // Resume scopes may list practice before analysis. Dispatch prerequisites
 // first so waiting dependants cannot occupy every worker slot.
 const items=p.job.tasks.filter(t=>t.state==='pending').sort((a,b)=>Number(b.kind==='analysis')-Number(a.kind==='analysis'));
 // Analyses can share the passage and wire schema. Other modules use their own prompts.
 const batches:GenerationTask[][]=[];
 const openBatches=new Map<string,GenerationTask[]>();
 for(const task of items){
  if(task.kind!=='analysis'){batches.push([task]);continue;}
  let batch=openBatches.get(task.passageId);
  if(!batch||batch.length===4){batch=[];openBatches.set(task.passageId,batch);batches.push(batch);}
  batch.push(task);
 }
 const analysisDone=new Map<string,Promise<void>>();
 const finish=new Map<string,()=>void>();
 for(const task of items.filter(t=>t.kind==='analysis')){
  for(const id of task.questionIds)analysisDone.set(id,new Promise(resolve=>finish.set(id,resolve)));
 }
 const live=(id:string)=>p.job.tasks!.find(t=>t.id===id)!;
 const stopped=()=>signal.aborted||!!p.job.stopReason;
 await taskPool(batches,async batch=>{
  const first=batch[0], ids=new Set(batch.map(t=>t.id));
  try{
   if(first.kind==='practice')await Promise.all(first.questionIds.map(id=>analysisDone.get(id)));
   if(stopped())return;
   for(const {id} of batch){
    const t=live(id);t.state='running';t.attempts++;t.error='';t.startedAt=Date.now();
    delete t.finishedAt;delete p.job.errors[id];t.phase='generating';
   }
   await checkpoint('正在生成：'+first.title);
   if(stopped())return;
   const status=(message:string)=>{
    for(const {id} of batch)live(id).phase=phaseFor(message);
    progress(structuredClone(p),message);
   };
   try{
    const snapshot=structuredClone(p);
    snapshot.job.tasks=snapshot.job.tasks!.filter(t=>ids.has(t.id));
    const result=await execute(snapshot,first,status);
    if(result.job.stopReason)p.job.stopReason=result.job.stopReason;
    const completed:GenerationTask[]=[];
    for(const {id} of batch){
     const t=live(id);
     if(t.kind==='analysis'){
      const outcome=result.job.tasks?.find(task=>task.id===id);
      if(outcome?.state==='complete')t.state='complete';
      else if(outcome?.state==='failed'){t.state='failed';t.error=outcome.error;}
      else if(signal.aborted)t.state='pending';
      else throw Error('解析未返回逐题结果：'+t.title);
     }else t.state=signal.aborted?'pending':'complete';
     if(t.state==='complete')completed.push(t);
    }
    if(completed.length){
     // Grouped analyses own only these question versions. Merge their snapshot once.
     const owned={...completed[0],questionIds:completed.flatMap(task=>task.questionIds)};
     p=mergeTaskResult(p,result,owned);
    }
   }catch(error){
    const message=error instanceof Error?error.message:String(error);
    for(const {id} of batch){const t=live(id);t.state=signal.aborted?'pending':'failed';t.error=signal.aborted?'':message;}
    if(!signal.aborted&&!isContentError(error))p.job.stopReason=message;
   }
   for(const {id} of batch){const t=live(id);t.finishedAt=Date.now();t.phase='saving';}
   p.job.done=p.job.tasks!.filter(t=>t.kind==='analysis'&&t.state==='complete').flatMap(t=>t.questionIds);
   await checkpoint(batch.every(t=>live(t.id).state==='complete')?'已保存：'+first.title:'本批有未完成项，请查看逐项进度');
  }finally{
   if(first.kind==='analysis')for(const t of batch)for(const id of t.questionIds)finish.get(id)!();
  }
 },stopped);
 for(const t of p.job.tasks!)if(t.state==='running')t.state='pending';
 p.job.errors=Object.fromEntries(p.job.tasks!.filter(t=>t.state==='failed').map(t=>[t.id,t.error]));
 p.job.state=signal.aborted?'cancelled':p.job.tasks!.every(t=>t.state==='complete')?'complete':p.job.tasks!.some(t=>t.state==='complete')?'partial':'failed';p.job.current=undefined;
 await checkpoint('本次并行生成结束，已保存内容保留');return p;
}
