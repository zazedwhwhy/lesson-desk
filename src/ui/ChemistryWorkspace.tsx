import React,{useState} from 'react';
import {X} from 'lucide-react';
import type {Project,Settings} from '../core/model';
import {chemSlides,chemChecks,type Chemistry,type ChemQuestion,type ChemModule} from '../core/chemistry';
import {applyChemReviewBatch,defaultChemSelection,resolveChemSelection,type ChemSelection} from '../core/chemistry-workflow';
import type {PptTemplate} from '../core/ppt-templates';
import {WorkspaceHeader} from './WorkspaceHeader';
import {PreparationPage} from './PreparationPage';
import {SourceMaterials} from './SourceMaterials';
import {OcrReview} from './OcrReview';
import {ReviewBatch} from './ReviewBatch';
import {PreparationOutputs} from './PreparationOutputs';
import {ChemistryQuestions} from './ChemistryQuestions';
import {ChemistryPreparationGeneration} from './ChemistryPreparationGeneration';
import {ChemistryTeaching} from './ChemistryTeaching';
import {ChemistryLessonSetup} from './ChemistryLessonSetup';
import {PresentationView} from './PresentationView';
import {invoke} from './api';
import './chemistry.css';
type Props={screen:string;onScreen:(s:string)=>void;generationSettings:Settings;template:PptTemplate;onTemplate:(t:PptTemplate)=>void;templatePending:boolean;onTemplatePending:(p:boolean)=>void;project:Project;onProject:(p:Project)=>void;onSave:(p:Project)=>Promise<unknown>;home:()=>void;settings:()=>void;message:string};
export function ChemistryWorkspace({project:p,onProject,onSave,home,settings,message,screen,onScreen,template,onTemplate,templatePending,onTemplatePending,generationSettings}:Props){
 const d=p.chemistry!;
 const [working,setBusy]=useState(false),[notice,setNotice]=useState(''),[dismissed,setDismissed]=useState(''),[qid,setQid]=useState(''),[module,setModule]=useState<ChemModule|'answers'>('analysis');
 const [font,setFont]=useState(24),[mode,setMode]=useState('compare'),[figures,setFigures]=useState(true),[sourceId,setSourceId]=useState(''),[paste,setPaste]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[report,setReport]=useState<string[]>([]),[modules,setModules]=useState<ChemModule[]>(['analysis']),[selection,setSelection]=useState<ChemSelection>({questionIds:[],modules:{}}),[deck,setDeck]=useState<ReturnType<typeof chemSlides>>([]);
 const busy=working||templatePending,scoped=d.questions.filter(q=>!selected.length||selected.includes(q.id)),questionIds=scoped.filter(q=>!chemChecks(q).length).map(q=>q.id);
 async function run(fn:()=>Promise<unknown>){setBusy(true);setNotice('');try{return await fn();}catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function change(fn:(p:Project)=>void){const n=structuredClone(p);fn(n);const saved=await onSave(n);if(!saved)throw Error('保存未完成，请重试');return saved;}
 async function edit(fn:(d:Chemistry)=>void){return change(n=>fn(n.chemistry!));}
 async function task(name:string,...args:unknown[]){const v=await invoke(name,p.id,...args);if(v?.schemaVersion){onProject(v);if(name==='files')setSourceId(v.sources.at(-1)?.id||'');}return v;}
 async function updateQuestion(id:string,fn:(q:ChemQuestion)=>void){return run(()=>edit(d=>{const q=d.questions.find(q=>q.id===id);if(!q)throw Error('题目已不存在');fn(q);}));}
 function setup(){setSelection(defaultChemSelection(d));onScreen('lesson-setup');}
 function selectedIds(){const r=resolveChemSelection(d,selection);if(r.issues.length)throw Error(r.issues.join('；'));return r.ids;}
 async function generate(ids:string[],ms:ChemModule[],resume:boolean){setBusy(true);setNotice('');try{return await task('generate-chemistry',ids,ms,resume);}finally{setBusy(false);}}
 async function fullscreen(){if(window.desk)await invoke('fullscreen');else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 if(screen==='show')return <PresentationView deck={deck} template={template} title={p.title} chinese back={()=>onScreen('lesson-setup')} fullscreen={()=>void run(fullscreen)}/>;
 return <><WorkspaceHeader title={p.title} screen={screen} busy={busy} font={font} mode={mode} translated={figures} translationLabel="附原题图示" setFont={setFont} setMode={setMode} setTranslated={setFigures} home={home} prepare={()=>onScreen(screen==='review'?'teach':'review')} present={setup} exportDeck={setup} fullscreen={()=>void run(fullscreen)} answers={()=>{setModule('answers');setMode('analysis');}} settings={settings}/>
 {(notice||(message!==dismissed&&message))&&<div className="notice" role="status">{notice||message}<button aria-label="关闭提示" onClick={()=>{setNotice('');setDismissed(message);}}><X size={16}/></button></div>}
 {screen==='review'&&<><OcrReview project={p} onProject={onProject} disabled={busy}/><PreparationPage organize={<button className="primary" disabled={busy||!p.sources.length||p.sources.some(s=>!!s.ocrPages?.length)} onClick={()=>{if(d.questions.length&&!confirm('重新整理会保存当前题目与讲义到整理历史，再生成新题目。继续？'))return;void run(()=>task('organize'));}}>整理试卷</button>}
 materials={<SourceMaterials paste={paste} setPaste={setPaste} project={p} busy={busy} sourceId={sourceId} setSourceId={setSourceId} change={change} run={run} task={(name,_id,...args)=>run(()=>task(name,...args))}/>}
 questions={<section className="chem-review"><ReviewBatch questions={d.questions} selected={selected} setSelected={setSelected} busy={busy} hint="核对前请对照原卷与答案；空题干、未核对题图或缺少图示说明会跳过。恢复题目后需重新核对。" report={report} apply={action=>void run(async()=>{const r=applyChemReviewBatch(d,selected,action);await change(n=>{n.chemistry=r.data;});setReport([`已更新 ${r.changed} 题`,...r.skipped]);})}/><ChemistryQuestions project={p} busy={busy} selected={selected} setSelected={setSelected} edit={edit} run={run}/></section>}
 checks={<><h2>完整性检查</h2>{d.questions.flatMap(q=>chemChecks(q).map(issue=><p key={q.id+issue}>第 {q.number} 题：{issue}</p>))}<p>请对照原卷核实条件、公式和图示；结构检查不代替教师确认。</p>{!!d.history.length&&<details><summary>整理历史 · {d.history.length} 版</summary>{d.history.map((h,i)=><p key={i}>{h.at} · {h.questions.length} 题 <button disabled={busy} onClick={()=>void run(()=>edit(d=>{const old=d.questions;d.questions=structuredClone(h.questions);d.history.push({at:new Date().toISOString(),questions:old});d.tasks=[];}))}>恢复这一版</button></p>)}</details>}</>}
 generation={<ChemistryPreparationGeneration data={d} modules={modules} setModules={setModules} questionIds={questionIds} selectedCount={selected.length} unconfirmed={scoped.filter(q=>!q.excluded&&!!chemChecks(q).length).length} excluded={scoped.filter(q=>q.excluded).length} busy={busy} connected={!!window.desk} provider={generationSettings.provider} model={generationSettings.model} settings={settings} generate={generate} cancel={()=>invoke('cancel',p.id)}/>}
 outputs={<PreparationOutputs busy={busy} canArrange={!!d.questions.length} arrange={setup} backup={()=>void run(async()=>{if(await task('export-bundle'))setNotice('备份课件包已导出，可重新导入工作台继续备课。');})}/>}/></>}
 {screen==='teach'&&<ChemistryTeaching data={d} questionId={qid} onQuestion={setQid} module={module} onModule={setModule} mode={mode} setMode={setMode} font={font} figures={figures} busy={busy} prepare={()=>onScreen('review')} edit={updateQuestion} generate={(q,m)=>void run(()=>task('generate-chemistry',[q],[m],false))}/>}
 {screen==='lesson-setup'&&<ChemistryLessonSetup data={d} selection={selection} onChange={setSelection} template={template} onTemplate={onTemplate} onTemplatePending={onTemplatePending} busy={busy} onBack={()=>onScreen('teach')} onPresent={()=>void run(async()=>{setDeck(chemSlides(d,selectedIds(),template.layout));onScreen('show');})} onExport={()=>void run(async()=>{const count=await task('export-ppt',selectedIds(),{templateId:template.id});if(count)setNotice(`已导出 ${count} 页课件，公式保留为矢量图。`);})}/>}
 {working&&screen!=='review'&&<div className="busy" role="status">正在处理，完成的内容会逐项保存。<button onClick={()=>void run(()=>invoke('cancel',p.id))}>取消任务</button></div>}</>;
}
