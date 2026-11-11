import React,{useState} from 'react';
import {applicableChineseModules,chineseModuleNames,chineseModules,type ChineseData,type ChineseModule} from '../core/chinese';
import {friendlyError} from '../core/errors';
import {PreparationProgress} from './PreparationProgress';
import {chinesePreparationScope} from './preparation-state';

type Props={data:ChineseData;groupIds:string[];setGroupIds:(ids:string[])=>void;modules:ChineseModule[];setModules:(modules:ChineseModule[])=>void;questionIds:string[];setQuestionIds:(ids:string[])=>void;busy:boolean;connected:boolean;provider:string;model:string;settings:()=>void;generate:(groups:string[],modules:ChineseModule[],resume:boolean,questions?:string[])=>Promise<unknown>;cancel:()=>Promise<unknown>};
const toggle=<T extends string>(items:T[],item:T,checked:boolean)=>checked?[...new Set([...items,item])]:items.filter(x=>x!==item);
export function ChinesePreparationGeneration({data:d,groupIds,setGroupIds,modules,setModules,questionIds,setQuestionIds,busy,connected,provider,model,settings,generate,cancel}:Props){
 const [active,setActive]=useState(false),[cancelling,setCancelling]=useState(false),[cancelSent,setCancelSent]=useState(false),[error,setError]=useState('');
 const scope=chinesePreparationScope(d,groupIds,modules,questionIds);
 const available=new Set(scope.groups.flatMap(applicableChineseModules));
 const blocked=busy||active;
 async function start(resume:boolean){setActive(true);setCancelling(false);setCancelSent(false);setError('');try{await generate(resume?[]:scope.groups.map(g=>g.id),resume?[]:modules,resume,resume?undefined:scope.questions.map(q=>q.id));}catch(e){setError(friendlyError(e));}finally{setActive(false);setCancelling(false);}}
 async function stop(){setCancelling(true);try{await cancel();setCancelSent(true);}catch(e){setError('取消未成功：'+friendlyError(e));setCancelling(false);}}
 const tasks=d.tasks.map(t=>({...t,title:`${d.groups.find(g=>g.id===t.groupId)?.title||'原材料组已不存在'}${t.questionId?' · 第 '+(d.groups.flatMap(g=>g.questions).find(q=>q.id===t.questionId)?.number||'待核实')+' 题':''} · ${chineseModuleNames[t.module]}`}));
 return <section className="prep-generation" id="prepare-generation" aria-labelledby="prepare-generation-heading">
   <h2 id="prepare-generation-heading">生成教学内容</h2><p>选择材料组与模块，一次开始。无参考答案时，AI 作答仍作为待核实建议。</p>
   {!d.groups.length&&<p className="prep-note">还没有材料组。请先上传或粘贴试卷并整理题目，再选择要生成的讲义。</p>}
   <fieldset className="prep-group-list" disabled={blocked}><legend>本次材料组</legend>{d.groups.map(g=><label key={g.id}><input type="checkbox" checked={groupIds.includes(g.id)} onChange={e=>setGroupIds(toggle(groupIds,g.id,e.target.checked))}/>{g.title}</label>)}</fieldset>
   <div className="prep-scope"><strong>{scope.groups.length} 个材料组 · {scope.questions.length} 道题 · {scope.taskCount} 项生成任务</strong><span>题目已排除项不参与；按材料组生成的模块只安排适用内容。</span></div>
   <details className="prep-question-scope"><summary>调整题目范围 · {scope.questions.length} 题已选{scope.unconfirmed?`，${scope.unconfirmed} 题待核对`:''}</summary><div className="actions"><button disabled={blocked} onClick={()=>setQuestionIds(scope.groups.flatMap(g=>g.questions.filter(q=>!q.excluded).map(q=>q.id)))}>选择这些材料组的全部题目</button><button disabled={blocked} onClick={()=>setQuestionIds([])}>清除题目选择</button></div>{scope.groups.map(g=><fieldset key={g.id} disabled={blocked}><legend>{g.title}</legend>{g.questions.filter(q=>!q.excluded).map(q=><label key={q.id}><input type="checkbox" checked={questionIds.includes(q.id)} onChange={e=>setQuestionIds(toggle(questionIds,q.id,e.target.checked))}/>第 {q.number} 题{!q.confirmed?'（待核对）':''}</label>)}</fieldset>)}</details>
   <fieldset className="prep-module-list" disabled={blocked}><legend>本次生成哪些内容</legend>{chineseModules.map(m=><label key={m}><input type="checkbox" checked={modules.includes(m)} disabled={!available.has(m)} onChange={e=>setModules(toggle(modules,m,e.target.checked))}/><span><strong>{chineseModuleNames[m]}</strong><small>{!available.has(m)?'不适用于当前材料组':['analysis','practice'].includes(m)?'按所选题目分别生成':'按适用材料组生成'}</small></span></label>)}</fieldset>
   <p className="prep-service">生成服务：{provider==='custom'?'自定义服务':provider} · {model||'尚未设置模型'}。相应材料会发送给此服务。<button className="prep-text-button" disabled={blocked} onClick={settings}>连接设置</button></p>
   {!connected&&<p className="prep-note">当前为浏览器预览，不能调用模型。请在桌面程序中连接服务后生成。</p>}
   {!!scope.unconfirmed&&<p className="prep-note">请先核对所选的 {scope.unconfirmed} 道题，或在题目范围中取消勾选，再开始生成。</p>}
   {!scope.taskCount&&<p className="prep-note">请选择材料组及适用模块；逐题讲评和考点演练还需要勾选题目。</p>}
   <div className="actions"><button className="primary" disabled={blocked||!connected||!!scope.unconfirmed||!scope.taskCount} onClick={()=>void start(false)}>开始生成所选内容</button>{!blocked&&d.tasks.some(t=>t.state!=='complete')&&<button disabled={!connected} onClick={()=>void start(true)}>继续上次未完成项</button>}{active&&<button disabled={cancelling} onClick={()=>void stop()}>{cancelling?'正在取消…':'取消本次生成'}</button>}</div>
   {error&&<p role="alert" className="error-text">{error}</p>}{cancelSent&&<p role="status">取消请求已发送。已保存内容保留，最终结果以下方逐项状态为准。</p>}
   <p className="prep-note">新生成保留旧版本与教师修订；继续时沿用上次材料组、模块及题目范围，跳过已保存项。生成完毕仍需在备课讲义中核实并确认。</p>
   <PreparationProgress tasks={tasks} active={active} cancelling={cancelling}/>
 </section>;
}
