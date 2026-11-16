import {it,expect} from 'vitest';
import {demoProject} from '../src/core/demo';
import {planSelectedGeneration} from '../src/core/generation';
import {runParallelGeneration} from '../src/desktop/parallel-generation';
import {commitTeachingModule} from '../src/desktop/teaching-parts';
import {taskPool,serialSnapshots} from '../src/core/task-pool';
import {emptyProject} from '../src/core/model';
import {chemQuestionSchema} from '../src/core/chemistry';
import {generateChemistry} from '../src/desktop/chemistry';
it('未知程序异常停止派发排队任务，保留已完成内容和具体错误',async()=>{
 let p=demoProject();delete p.passages[0].learning;p=planSelectedGeneration(p,[p.questions[0].id],['translation','sentences','structure','lexicon','imitation']);let calls=0;
 const out=await runParallelGeneration(p,new AbortController().signal,async()=>{calls++;throw new TypeError('内部状态损坏');},async()=>{});
 expect(calls).toBeLessThanOrEqual(3);expect(out.job.stopReason).toBe('内部状态损坏');expect(out.job.tasks!.some(t=>t.state==='pending')).toBe(true);
});
it('同篇三个模块同时执行，乱序完成后各模块结果均保留且逐项保存',async()=>{
 let p=demoProject();delete p.passages[0].learning;
 p=planSelectedGeneration(p,[p.questions[0].id],['translation','structure','lexicon']);
 let active=0,peak=0;const saves:number[]=[];const phases:string[]=[];
 const result=await runParallelGeneration(p,new AbortController().signal,async(p,t,status)=>{
  peak=Math.max(peak,++active);status?.('正在复核');
  await new Promise(r=>setTimeout(r,t.kind==='translation'?30:t.kind==='structure'?20:5));active--;
  if(t.kind==='translation'){p.passages[0].translation='译文';return p;}
  if(t.kind==='structure')return commitTeachingModule(p,t.passageId,'structure',{genre:'结构标记',theme:'',outline:[],logic:'',examFocus:''});
  return commitTeachingModule(p,t.passageId,'lexicon',[]);
 },async p=>{saves.push(p.job.tasks!.filter(t=>t.state==='complete').length);},false,p=>{phases.push(...p.job.tasks!.map(t=>t.phase||''));});
 expect(peak).toBe(3);expect(result.passages[0].translation).toBe('译文');
 const a=result.passages[0],v=a.learning!.versions.find(v=>v.id===a.learning!.activeVersion)!;
 expect(v.data.structure.genre).toBe('结构标记');expect(v.completedModules).toEqual(expect.arrayContaining(['structure','lexicon']));
 expect(saves).toEqual(expect.arrayContaining([1,2,3]));expect(phases).toContain('reviewing');
 expect(result.job.tasks!.every(t=>t.finishedAt!>=t.startedAt!)).toBe(true);
});
it('磁盘保存严格排队，失败停止后续写入并向调用方报告',async()=>{
 const writes:number[]=[];const save=serialSnapshots<number>(async n=>{writes.push(n);if(n===2)throw Error('disk full');});
 await save(1);await expect(save(2)).rejects.toThrow('disk full');await expect(save(3)).rejects.toThrow('disk full');expect(writes).toEqual([1,2]);
});
it('恢复清单中练习排在解析前也能完成，不占满槽位等待尚未派发的前置任务',async()=>{
 let p=demoProject();p=planSelectedGeneration(p,p.questions.slice(0,3).map(q=>q.id),['practice','analysis']);
 p.job.tasks!.sort((a,b)=>Number(b.kind==='practice')-Number(a.kind==='practice'));
 const seen:string[]=[];
 const out=await runParallelGeneration(p,new AbortController().signal,async(p,t)=>{seen.push(t.kind);return p;},async()=>{},true);
 expect(out.job.state).toBe('complete');expect(seen[0]).toBe('analysis');
});
it('任务池最多三项，取消后不启动排队任务且等待在途任务结束',async()=>{
 let cancelled=false,active=0,peak=0;const called:number[]=[];
 await taskPool([1,2,3,4,5],async n=>{called.push(n);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,5));cancelled=true;active--;},()=>cancelled);
 expect(peak).toBe(3);expect(called).toEqual([1,2,3]);expect(active).toBe(0);
});
it('化学同题四个模块三并发，逐项保存全部讲义且保存不存在重叠',async()=>{
 const p=emptyProject('化学','chemistry');p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',number:'1',stem:'题目',answer:'参考',confirmed:true})];
 let active=0,peak=0,saving=0;const counts:number[]=[];
 let release!:()=>void;const firstThree=new Promise<void>(resolve=>{release=resolve;});
 const out=await generateChemistry(p,['q'],['analysis','knowledge','method','experiment'],new AbortController().signal,async p=>{
  expect(++saving).toBe(1);await new Promise(r=>setTimeout(r,1));counts.push(p.chemistry!.questions[0].versions.length);saving--;
 },async()=>{peak=Math.max(peak,++active);if(active===3)release();await firstThree;active--;return {status:'ok',notices:[],blocks:[{label:'讲解',text:'依据'}]};});
 expect(peak).toBe(3);expect(out.chemistry!.questions[0].versions).toHaveLength(4);expect(counts).toEqual(expect.arrayContaining([1,2,3,4]));
});
