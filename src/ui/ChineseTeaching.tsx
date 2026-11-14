import React,{useEffect,useState} from 'react';
import {Menu,Upload} from 'lucide-react';
import {uid} from '../core/model';
import {applicableChineseModules,chineseKindNames,chineseModuleNames,chineseFingerprint,type ChineseData,type ChineseGroup,type ChineseModule} from '../core/chinese';
import {latestChineseVersion} from '../core/chinese-lesson-selection';

type Props={data:ChineseData;groupId:string;onGroup:(id:string)=>void;module:ChineseModule|'answers';onModule:(m:ChineseModule|'answers')=>void;mode:string;setMode:(s:string)=>void;font:number;translated:boolean;busy:boolean;prepare:()=>void;generate:(g:string,m:ChineseModule,q?:string)=>void;edit:(gid:string,fn:(g:ChineseGroup)=>void)=>Promise<void>};
export function ChineseTeaching(p:Props){
 const [toc,setToc]=useState(true),[split,setSplit]=useState(50),[revealed,setRevealed]=useState<string[]>([]),[versions,setVersions]=useState<Record<string,string>>({});
 const g=p.data.groups.find(g=>g.id===p.groupId)||p.data.groups[0];
 const modules=g?applicableChineseModules(g):[];
 const module=p.module==='answers'||modules.includes(p.module)?p.module:'analysis';
 useEffect(()=>{setRevealed([]);},[g?.id]);
 function notes(questionId?:string){
  if(!g||module==='answers')return null;
  const key=g.id+':'+module+':'+(questionId||''),history=g.versions.filter(v=>v.module===module&&v.questionId===questionId);
  const v=history.find(v=>v.id===versions[key])||latestChineseVersion(g,module,questionId);
  const stale=v&&v.fingerprint!==chineseFingerprint(p.data,g,questionId);
  return <div className="zh-lesson-notes" data-source-group={g.id} data-source-version={v?.id}>
   {v?<><p className="zh-meta">{stale?'材料已变化，内容过期':v.confirmed?'教师已确认':v.result.status==='ok'?'已生成，待教师确认':'待核实'}{v.result.notices.length?' · '+v.result.notices.join('；'):''}</p>
    {v.result.blocks.map((b,i)=><section key={i}><h3>{b.label}</h3>{/答案|作答|参考|范例/.test(b.label)?<details><summary>展开参考内容</summary><p className="prewrap">{b.text}</p></details>:<p className="prewrap">{b.text}</p>}{b.evidence.map((e,j)=><blockquote key={j}><a href={'#zh-material-'+e.materialId} onClick={()=>p.setMode('compare')}>{e.quote}</a></blockquote>)}</section>)}
    <details><summary>修改讲解与版本</summary><label>历史版本<select value={v.id} onChange={e=>setVersions({...versions,[key]:e.target.value})}>{history.slice().reverse().map(v=><option key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()}{v.result.notices.includes('教师修订')?' · 教师修订':''}</option>)}</select></label>
     <label>讲义正文<textarea key={v.id} defaultValue={v.result.blocks.map(b=>b.label+'\n'+b.text).join('\n\n')} id={'edit-'+v.id} disabled={p.busy||!!stale}/></label>
     <button disabled={p.busy||!!stale} onClick={()=>void p.edit(g.id,g=>{const text=(document.getElementById('edit-'+v.id) as HTMLTextAreaElement).value;if(!text.trim())throw Error('讲义不能为空');const id=uid();g.versions.push({...structuredClone(v),id,createdAt:new Date().toISOString(),confirmed:false,result:{status:'ok',notices:['教师修订'],blocks:[{label:'教师修订讲义',text,evidence:v.result.blocks.flatMap(b=>b.evidence)}]}});setVersions({...versions,[key]:id});})}>另存教师修订版</button>
    </details>
    <button disabled={p.busy||!!stale||v.result.status!=='ok'} onClick={()=>void p.edit(g.id,g=>{g.versions.find(x=>x.id===v.id)!.confirmed=!v.confirmed;})}>{v.confirmed?'取消讲义确认':'已核实，确认本版讲义'}</button>
    {v.result.status!=='ok'&&<p>请核实后保存教师修订版，再确认讲义。原版保留在历史中。</p>}
   </>:<p>此模块尚未生成，可到整理材料中选择生成内容。</p>}
   <button disabled={p.busy} onClick={()=>p.generate(g.id,module,questionId)}>{v?'重新生成':'生成'}{questionId?'本题':''}{chineseModuleNames[module]}</button>
  </div>;
 }
 const qs=g?.questions.filter(q=>!q.excluded)||[];
 return <><nav className="tabs"><button aria-label="切换题目目录" onClick={()=>setToc(!toc)}><Menu size={17}/></button>{p.data.groups.map(a=><button key={a.id} className={g?.id===a.id?'active':''} onClick={()=>{p.onGroup(a.id);p.onModule('analysis');}}>{a.title}</button>)}</nav>
  {!g?<main className="empty"><h1>还没有整理好的题目</h1><button className="primary" onClick={p.prepare}><Upload size={17}/>上传与核对</button></main>:<div className="classroom chinese-classroom" style={{'--text-size':p.font+'px'} as React.CSSProperties}>
   {toc&&<aside className="toc"><h3>题目目录</h3><p className="toc-subtitle">{chineseKindNames[g.kind]} · {qs.length} 题</p><nav aria-label="本篇题目">{qs.map(q=><button className="question-link" key={q.id} onClick={()=>{p.onModule('analysis');p.setMode('compare');setTimeout(()=>document.getElementById('q-'+q.id)?.scrollIntoView({block:'start'}),0);}}><span>第 {q.number} 题</span><small>{latestChineseVersion(g,'analysis',q.id)?'已有讲评':'待生成'}</small></button>)}</nav><p className="toc-summary">本篇已生成 {qs.filter(q=>latestChineseVersion(g,'analysis',q.id)).length} / {qs.length} 题<br/>点击题号定位讲评</p><hr/><small>当前课件已保存到本机</small></aside>}
   <div className={'columns '+p.mode}>{p.mode!=='analysis'&&<article data-source-group={g.id} className="reading" style={{flexBasis:p.mode==='original'?'100%':split+'%'}}><h2>{g.title}</h2>{[...g.materials,...p.data.groups.flatMap(a=>a.materials).filter(m=>!g.materials.some(x=>x.id===m.id)&&qs.some(q=>q.materialIds.includes(m.id)))].map(m=><section id={'zh-material-'+m.id} key={m.id}><h3>{m.title}</h3><p className="prewrap">{m.text}</p>{m.image&&<a href={m.image} target="_blank" rel="noreferrer"><img className="zh-source-image" src={m.image} alt={m.title+'原页'}/></a>}</section>)}{p.translated&&<section className="translation"><h3>文言译注</h3>{latestChineseVersion(g,'translation')?.result.blocks.map((b,i)=><p key={i}>{b.text}</p>)||<p>此材料尚无文言译注。</p>}</section>}</article>}
   {p.mode==='compare'&&<div className="splitter"><input aria-label="分栏宽度" type="range" min="25" max="75" value={split} onChange={e=>setSplit(+e.target.value)}/></div>}
   {p.mode!=='original'&&<article className="explanations"><nav className="section-tabs" aria-label="讲评内容">{modules.map(m=><button key={m} aria-current={module===m?'page':undefined} className={module===m?'active':''} onClick={()=>p.onModule(m)}>{chineseModuleNames[m]}</button>)}<button className={module==='answers'?'active':''} onClick={()=>p.onModule('answers')}>参考答案</button></nav>
    {module==='answers'?p.data.groups.flatMap(g=>g.questions).filter(q=>!q.excluded).map(q=><p key={q.id}>第 {q.number} 题：{q.answer||'待补充'}</p>):module==='analysis'||module==='practice'?qs.map(q=><section id={'q-'+q.id} className="q-card" key={q.id}><div className="q-heading"><strong>第 {q.number} 题</strong><small>{chineseKindNames[g.kind]}</small></div><p>{q.stem}</p>{q.options.map((o,i)=><p className="option" key={i}>{o}</p>)}<button onClick={()=>setRevealed(revealed.includes(q.id)?revealed.filter(id=>id!==q.id):[...revealed,q.id])}>{revealed.includes(q.id)?'收起讲解':'显示答案与讲解'}</button>{revealed.includes(q.id)&&<div className="answer">{module==='analysis'&&<h3>参考答案：{q.answer||'未提供，AI 作答需核实'}</h3>}{notes(q.id)}</div>}</section>):notes()}
   </article>}</div>
  </div>}
 </>;
}
