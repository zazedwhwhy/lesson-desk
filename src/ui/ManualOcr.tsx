import React,{useState} from 'react';
import type {Project} from '../core/model';
import {parseOcrPages,pdfPageCount} from '../core/manual-ocr';
export function ManualOcr({project,sourceId,setSourceId,busy,run,task}:{project:Project;sourceId:string;setSourceId:(id:string)=>void;busy:boolean;run:(fn:()=>Promise<unknown>)=>Promise<unknown>;task:(name:string,...args:any[])=>Promise<any>}){
 const [pages,setPages]=useState('');
 const pdfs=project.sources.filter(s=>s.kind==='pdf'&&s.asset),source=pdfs.find(s=>s.id===sourceId)||pdfs[0];
 if(!source)return null;
 return <details><summary>按原页重新识别 · 公式、图表或提取文字不完整时使用</summary><p>PDF有文字层时会自动提取，无需扫描识别。若公式、结构式或图表不完整，可选择原页发送给当前视觉模型重新识别；识别前文字会保留，识别后须核对，原课件题目和讲评不会自动替换。</p><div className="actions"><label>PDF<select aria-label="选择按原页识别的PDF" value={source.id} disabled={busy} onChange={e=>{setSourceId(e.target.value);setPages('');}}>{pdfs.map(s=><option key={s.id} value={s.id}>{s.name}（{pdfPageCount(s)}页）</option>)}</select></label><label>页码<input aria-label="重新识别页码" value={pages} disabled={busy} onChange={e=>setPages(e.target.value)} placeholder="1,3-5；留空识别整份PDF"/></label><button disabled={busy} onClick={()=>void run(()=>task('ocr',project.id,{sourceId:source.id,pages:parseOcrPages(pages,pdfPageCount(source))}))}>按原页重新识别</button></div></details>;
}
