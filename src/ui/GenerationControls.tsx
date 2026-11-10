import React from 'react';
import type {Project} from '../core/model';
import {taskKinds,generationNames,type GenerationContent} from '../core/generation-model';
import {generationJobFor} from '../core/generation';
import {GenerationStatus} from './GenerationStatus';
export function GenerationControls({p,kinds,setKinds,selected,busy,provider,generate,cancel}:{p:Project;kinds:GenerationContent[];setKinds:(kinds:GenerationContent[])=>void;selected:string[];busy:boolean;provider:string;generate:(kinds:GenerationContent[],ids:string[],resume:boolean)=>void;cancel:()=>void}){
 const ids=p.questions.filter(q=>q.confirmed&&!q.excluded&&(!selected.length||selected.includes(q.id))).map(q=>q.id);
 const jobs=kinds.map(kind=>({kind,job:generationJobFor(p,kind)}));
 const unfinished=jobs.filter(({job})=>job?.tasks?.some(t=>t.state!=='complete')).map(({kind})=>kind);
 const tasks=jobs.flatMap(({job})=>job?.tasks||[]),complete=tasks.filter(t=>t.state==='complete').length;
 return <section className="generation-controls" aria-label="自选生成">
  <h3>准备教学内容</h3>
  <fieldset className="generation-choices" disabled={busy}><legend>勾选需要的内容</legend>{taskKinds.map(kind=><label key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={e=>setKinds(e.target.checked?[...kinds,kind]:kinds.filter(k=>k!==kind))}/>{generationNames[kind]}</label>)}</fieldset>
  <p>范围：{selected.length?'当前勾选中':'整卷'}已核对且未排除的 {ids.length} 道题。将向 {provider} 发送相应材料。</p>
  <div className="actions"><button className="primary" disabled={busy||!ids.length||!kinds.length} onClick={()=>generate(kinds,ids,false)}>开始生成{Boolean(kinds.length)&&`（${kinds.length}项）`}</button>{!busy&&unfinished.length>0&&<button onClick={()=>generate(unfinished,[],true)}>继续未完成</button>}{busy&&<button onClick={cancel}>取消任务</button>}<span className="muted">按项保存，结束后通过系统通知提醒。</span></div>
  {!kinds.length&&<p className="muted">请先勾选至少一项内容。</p>}
  {!!tasks.length&&<div className="generation-overview" role="status">所选内容上次进度：已保存 {complete}/{tasks.length} 项。{unfinished.length>0&&'继续时沿用各项上次题目范围，跳过已保存内容。'}</div>}
  {jobs.filter(({job})=>job).map(({kind,job})=><details className="generation-kind-status" key={kind} open={busy&&p.job.tasks?.some(t=>t.kind===kind&&t.state==='running')}><summary>{generationNames[kind]} · 已保存 {job!.tasks!.filter(t=>t.state==='complete').length}/{job!.tasks!.length}{job!.tasks!.some(t=>t.state==='failed')?' · 有失败项':''}</summary><GenerationStatus p={{...p,job:job!}}/></details>)}
 </section>;
}
