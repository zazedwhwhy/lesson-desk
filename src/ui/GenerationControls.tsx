import React,{useEffect,useState} from 'react';
import type {Project} from '../core/model';
import {taskKinds,generationNames,type GenerationContent} from '../core/generation-model';
import {generationJobFor} from '../core/generation';
import {friendlyError} from '../core/errors';
import {PreparationProgress} from './PreparationProgress';

const descriptions:Record<GenerationContent,string>={analysis:'逐题答案依据与解题思路',translation:'本篇原文的中文对照',practice:'围绕原题考点的新题',sentences:'句子主干、成分与作用',structure:'段落关系与文章结构',lexicon:'语境义、搭配与例句',imitation:'句式骨架与仿写任务',special:'适用题型的专项指导'};
export function GenerationControls({p,kinds,setKinds,selected,busy,provider,model,connected,settings,generate,cancel}:{p:Project;kinds:GenerationContent[];setKinds:(kinds:GenerationContent[])=>void;selected:string[];busy:boolean;provider:string;model:string;connected:boolean;settings:()=>void;generate:(kinds:GenerationContent[],ids:string[],resume:boolean)=>void;cancel:()=>Promise<unknown>}){
 const [cancelling,setCancelling]=useState(false),[cancelError,setCancelError]=useState('');
 useEffect(()=>{if(!busy)setCancelling(false);},[busy]);
 const scoped=p.questions.filter(q=>!selected.length||selected.includes(q.id));
 const ids=scoped.filter(q=>q.confirmed&&!q.excluded).map(q=>q.id);
 const jobs=kinds.map(kind=>({kind,job:generationJobFor(p,kind)}));
 const unfinished=jobs.filter(({job})=>job?.tasks?.some(t=>t.state!=='complete')).map(({kind})=>kind);
 const active=busy&&p.job.state==='running'&&p.job.mode==='selected';
 async function stop(){setCancelling(true);setCancelError('');try{await cancel();}catch(e){setCancelling(false);setCancelError(friendlyError(e));}}
 return <section className="prep-generation" id="prepare-generation" aria-labelledby="prepare-generation-heading">
  <div className="prep-section-heading"><div><h2 id="prepare-generation-heading">生成教学内容</h2><p>选好需要的模块，一次开始。只安排题型适用内容，各项独立保存，生成后仍需教师核对。</p></div></div>
  <div className="prep-scope"><strong>{selected.length?'当前勾选题目':'整张试卷'} · {ids.length} 道题可生成</strong><span>仅使用已核对、未排除的题目。{scoped.filter(q=>!q.confirmed&&!q.excluded).length} 题待核对，{scoped.filter(q=>q.excluded).length} 题已排除。</span></div>
  <fieldset className="prep-module-list" disabled={busy}><legend>本次生成哪些内容</legend>{taskKinds.map(kind=><label key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={e=>setKinds(e.target.checked?[...kinds,kind]:kinds.filter(k=>k!==kind))}/><span><strong>{kind==='analysis'?'逐题讲评':generationNames[kind]}</strong><small>{descriptions[kind]}</small></span></label>)}</fieldset>
  <p className="prep-service">生成服务：{provider==='custom'?'自定义服务':provider} · {model||'尚未设置模型'}。相应材料会发送给此服务。<button className="prep-text-button" disabled={busy} onClick={settings}>连接设置</button></p>
  {!connected&&<p className="prep-note">当前为浏览器预览，不能调用模型。请在桌面程序中连接服务后生成。</p>}
  <div className="actions"><button className="primary" disabled={busy||!connected||!ids.length||!kinds.length} onClick={()=>{setCancelError('');generate(kinds,ids,false);}}>开始生成{kinds.length?`（${kinds.length} 个模块）`:''}</button>{!busy&&unfinished.length>0&&<button disabled={!connected} onClick={()=>{setCancelError('');generate(unfinished,[],true);}}>继续所选模块的未完成项</button>}{active&&<button disabled={cancelling} onClick={()=>void stop()}>{cancelling?'正在取消…':'取消本次生成'}</button>}</div>
  {!kinds.length&&<p className="prep-note">请先勾选至少一个模块。</p>}{!ids.length&&<p className="prep-note">请先在题目清单中核对题面与答案，再开始生成。</p>}
  {cancelError&&<p role="alert" className="error-text">取消未成功：{cancelError}</p>}
  <p className="prep-note">新生成会保留历史版本；继续未完成项沿用各模块上次范围，与当前勾选题目无关。生成结束后会尝试发送系统通知。</p>
  {jobs.filter(({job})=>job).map(({kind,job})=><section className="prep-module-progress" key={kind}><h3>{kind==='analysis'?'逐题讲评':generationNames[kind]} · 上次任务</h3><PreparationProgress tasks={job!.tasks||[]} job={job} active={active&&job!.state==='running'} cancelling={cancelling}/></section>)}
 </section>;
}
