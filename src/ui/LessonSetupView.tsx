import React from 'react';
import {ArrowLeft,Download,Play} from 'lucide-react';
import {PptTemplatePicker} from './PptTemplatePicker';
import type {PptTemplate} from '../core/ppt-templates';

export type LessonGroupChoice={id:string;title:string;chosen:boolean;singleQuestion?:boolean;questions:{id:string;number:string;selected:boolean;reason:string|null}[];modules:{id:string;name:string;selected:boolean;reason:string|null}[]};
export type LessonSetupViewProps={groups:LessonGroupChoice[];pages:number;issues:string[];busy:boolean;template:PptTemplate;onTemplate:(t:PptTemplate)=>void;onTemplatePending:(p:boolean)=>void;toggleGroup:(id:string,checked:boolean)=>void;toggleQuestion:(id:string,checked:boolean)=>void;toggleModule:(gid:string,id:string,checked:boolean)=>void;onPresent:()=>void;onExport:()=>void;onBack:()=>void};
export function LessonSetupView(p:LessonSetupViewProps){
 const count=p.groups.filter(g=>g.chosen);
 return <main className="lesson-setup" data-screen-label="授课内容选择">
  <button className="settings-back" disabled={p.busy} onClick={p.onBack}><ArrowLeft size={17}/>返回教案</button><header className="lesson-setup-heading"><div><h1>编排本次讲课</h1><p>勾选本节要讲的内容，按需要调整题目和版式，再放映或导出。</p></div><div className="lesson-page-count"><strong>{p.pages}</strong><span>预计页面</span></div></header>
  <details className="setup-template"><summary>课件版式 · {p.template.name}</summary><PptTemplatePicker value={p.template} onChange={p.onTemplate} onPending={p.onTemplatePending} busy={p.busy}/></details>
  <div className="lesson-setup-layout"><div className="lesson-groups">{p.groups.map(g=><section className={'lesson-group'+(g.chosen?' is-selected':'')} key={g.id}>
   <label className="lesson-passage"><input type="checkbox" checked={g.chosen} disabled={p.busy} onChange={e=>p.toggleGroup(g.id,e.target.checked)}/><span><strong>{g.title}</strong><small>{g.questions.length} 道题 · {g.questions.filter(q=>q.selected).length} 道已选</small></span></label>
   {g.chosen&&<details className="lesson-group-body"><summary>调整本组内容 · 已选 {g.questions.filter(q=>q.selected).length} 题、{g.modules.filter(m=>m.selected).length} 项内容</summary>{!g.singleQuestion&&<fieldset><legend>题目</legend><div className="lesson-choice-grid">{g.questions.length?g.questions.map(q=><label className="lesson-choice" key={q.id}><input type="checkbox" checked={q.selected} disabled={p.busy} onChange={e=>p.toggleQuestion(q.id,e.target.checked)}/><span>第 {q.number} 题<small>{q.reason||'讲评已完成'}</small></span></label>):<p className="lesson-hint">本篇暂无题目，可选择原文和篇章内容。</p>}</div></fieldset>}
    <fieldset><legend>讲课内容</legend><div className="lesson-choice-grid">{g.modules.map(m=><label className={'lesson-choice'+(m.reason?' is-unavailable':'')} key={m.id}><input type="checkbox" checked={m.selected} disabled={p.busy||!!m.reason&&!m.selected} onChange={e=>p.toggleModule(g.id,m.id,e.target.checked)}/><span>{m.name}<small>{m.reason||'已完成，可加入'}</small></span></label>)}</div></fieldset>
   </details>}
  </section>)}{!p.groups.length&&<p className="lesson-empty">请先整理试卷并生成讲义。</p>}</div>
  <aside className="lesson-summary"><h2>本次课件</h2><p>原文、题面、讲评与练习答案按授课顺序排好；内容较长时自动接续到下一页。</p><div className="lesson-summary-count"><strong>{count.length}</strong><span>组内容</span><strong>{count.reduce((n,g)=>n+g.questions.filter(q=>q.selected).length,0)}</strong><span>道题</span><strong>{p.pages}</strong><span>页课件</span></div>{p.issues.length?<div className="lesson-issues" role="status"><strong>请调整所选内容</strong><p>{p.issues[0]}</p>{p.issues.length>1&&<details><summary>其余 {p.issues.length-1} 项</summary><ul>{p.issues.slice(1).map((s,i)=><li key={i}>{s}</li>)}</ul></details>}</div>:<p className="lesson-ready" role="status">{p.pages?'课件已就绪。':'请选择要讲的内容。'}</p>}<div className="lesson-setup-actions"><button className="primary" disabled={p.busy||!p.pages||!!p.issues.length} onClick={p.onPresent}><Play size={17}/>开始授课</button><button disabled={p.busy||!p.pages||!!p.issues.length} onClick={p.onExport}><Download size={17}/>输出可编辑 PPT</button></div></aside></div>
 </main>;
}
