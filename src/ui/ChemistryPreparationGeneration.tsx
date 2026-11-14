import React,{useState} from 'react';
import {chemChecks,chemModules,chemNames,type Chemistry,type ChemModule} from '../core/chemistry';
import {friendlyError} from '../core/errors';
import {PreparationProgress} from './PreparationProgress';


type Props={selectedCount:number;unconfirmed:number;excluded:number;data:Chemistry;modules:ChemModule[];setModules:(modules:ChemModule[])=>void;questionIds:string[];busy:boolean;connected:boolean;provider:string;model:string;settings:()=>void;generate:(questions:string[],modules:ChemModule[],resume:boolean)=>Promise<unknown>;cancel:()=>Promise<unknown>};
const toggle=<T extends string>(items:T[],item:T,checked:boolean)=>checked?[...new Set([...items,item])]:items.filter(x=>x!==item);
export function ChemistryPreparationGeneration({data:d,modules,setModules,questionIds,selectedCount,unconfirmed,excluded,busy,connected,provider,model,settings,generate,cancel}:Props){
 const [active,setActive]=useState(false),[cancelling,setCancelling]=useState(false),[cancelSent,setCancelSent]=useState(false),[error,setError]=useState('');
 const scope={questions:d.questions.filter(q=>questionIds.includes(q.id)&&!chemChecks(q).length),taskCount:questionIds.length*modules.length};
 const blocked=busy||active;
 async function start(resume:boolean){setActive(true);setCancelling(false);setCancelSent(false);setError('');try{await generate(resume?[]:scope.questions.map(q=>q.id),resume?[]:modules,resume);}catch(e){setError(friendlyError(e));}finally{setActive(false);setCancelling(false);}}
 async function stop(){setCancelling(true);try{await cancel();setCancelSent(true);}catch(e){setError('取消未成功：'+friendlyError(e));setCancelling(false);}}
 const tasks=d.tasks.map(t=>({...t,title:`第 ${d.questions.find(q=>q.id===t.questionId)?.number||'待核实'} 题 · ${chemNames[t.module]}`}));
 return <section className="prep-generation" id="prepare-generation" aria-labelledby="prepare-generation-heading">
   <h2 id="prepare-generation-heading">生成教学内容</h2><p>选好需要的模块，一次开始。逐题安排所选内容，各项独立保存，生成后仍需教师核对。</p>
   {!d.questions.length&&<p className="prep-note">还没有题目。请先上传或粘贴试卷并整理题目，再选择要生成的讲义。</p>}
   <div className="prep-scope"><strong>{selectedCount?'当前勾选题目':'整张试卷'} · {scope.questions.length} 道题可生成</strong><span>仅使用已核对、未排除的题目。{unconfirmed} 题待核对，{excluded} 题已排除。</span></div>
   <fieldset className="prep-module-list" disabled={blocked}><legend>本次生成哪些内容</legend>{chemModules.map(m=><label key={m}><input type="checkbox" checked={modules.includes(m)} onChange={e=>setModules(toggle(modules,m,e.target.checked))}/><span><strong>{chemNames[m]}</strong><small>按所选题目分别生成</small></span></label>)}</fieldset>
   <p className="prep-service">生成服务：{provider==='custom'?'自定义服务':provider} · {model||'尚未设置模型'}。相应材料会发送给此服务。<button className="prep-text-button" disabled={blocked} onClick={settings}>连接设置</button></p>
   {!connected&&<p className="prep-note">当前为浏览器预览，不能调用模型。请在桌面程序中连接服务后生成。</p>}

   {!scope.taskCount&&<p className="prep-note">请先在题目清单中核对题面，并勾选至少一个适用模块。</p>}
   <div className="actions"><button className="primary" disabled={blocked||!connected||!scope.taskCount} onClick={()=>void start(false)}>开始生成{modules.length?`（${modules.length} 个模块）`:''}</button>{!blocked&&d.tasks.some(t=>t.state!=='complete')&&<button disabled={!connected} onClick={()=>void start(true)}>继续上次未完成项</button>}{active&&<button disabled={cancelling} onClick={()=>void stop()}>{cancelling?'正在取消…':'取消本次生成'}</button>}</div>
   {error&&<p role="alert" className="error-text">{error}</p>}{cancelSent&&<p role="status">取消请求已发送。已保存内容保留，最终结果以下方逐项状态为准。</p>}
   <p className="prep-note">新生成保留旧版本与教师修订；继续时沿用上次模块及题目范围，跳过已保存项。生成完毕仍需返回教案核实并确认。</p>
   <PreparationProgress tasks={tasks} active={active} cancelling={cancelling}/>
 </section>;
}
