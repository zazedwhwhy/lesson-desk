import React,{useState} from 'react';
import type {Project} from '../core/model';
import {pendingOcrPages} from '../core/source-fidelity';
import {invoke} from './api';

export function OcrReview({project:p,onProject,disabled=false}:{project:Project;onProject:(p:Project)=>void;disabled?:boolean}){
 const [draft,setDraft]=useState<Record<string,string>>({}),[image,setImage]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pages=p.sources.flatMap(s=>pendingOcrPages(s).map(page=>({source:s,page})));
 if(!pages.length)return null;
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function update(sourceId:string,page:number,confirm:boolean){
  const next=structuredClone(p),source=next.sources.find(s=>s.id===sourceId)!;
  if(confirm){source.ocrVerifiedPages=[...new Set([...(source.ocrVerifiedPages||[]),page])];source.ocrReviewPages=(source.ocrReviewPages||[]).filter(n=>n!==page);}
  else{const before=structuredClone(source.blocks.filter(b=>b.page===page));source.blocks=source.blocks.map(b=>b.page===page&&draft[b.id]!==undefined?{...b,text:draft[b.id]}:b);source.ocrCorrections??=[];source.ocrCorrections.push({page,at:new Date().toISOString(),before,after:structuredClone(source.blocks.filter(b=>b.page===page))});source.ocrVerifiedPages=(source.ocrVerifiedPages||[]).filter(n=>n!==page);source.ocrReviewPages=[...new Set([...(source.ocrReviewPages||[]),page])];}
  const saved=await invoke('save',next);onProject(saved);setDraft({});setMessage(confirm?'原页核对已记录，可继续整理。':'校订已保存，OCR原始转录仍保留；请再核对并确认本页。');
 }
 return <section className="panel" aria-label="OCR原页核对"><h2>OCR 原页核对</h2><p>OCR可能把改错题的错字改正确。请对照原图核对题号、空号、选项、公式和故意错字；核对前暂不整理试卷。</p>{message&&<p role="status">{message}</p>}{pages.map(({source:s,page})=>{const key=s.id+':'+page,blocks=s.blocks.filter(b=>b.page===page),dirty=blocks.some(b=>draft[b.id]!==undefined&&draft[b.id]!==b.text);return <details key={key}><summary>{s.name} · 第{page}页待核对</summary><button disabled={disabled||busy} onClick={()=>void run(async()=>setImage({...image,[key]:await invoke('chinese-image',p.id,s.id,page)}))}>显示第{page}页原图</button>{image[key]&&<img src={image[key]} alt={'OCR核对原页'+page} style={{maxWidth:'100%',objectFit:'contain'}}/>}{blocks.map((b,i)=><label key={b.id}>第{page}页段落{i+1}<textarea aria-label={'OCR第'+page+'页段落'+(i+1)} value={draft[b.id]??b.text} onChange={e=>setDraft({...draft,[b.id]:e.target.value})}/></label>)}<button disabled={disabled||busy||!dirty} onClick={()=>void run(()=>update(s.id,page,false))}>保存本页校订</button><button disabled={disabled||busy||dirty||!image[key]} onClick={()=>void run(()=>update(s.id,page,true))}>已对照原图核对第{page}页</button>{dirty&&<p>请先保存校订，再确认本页。</p>}</details>;})}</section>;
}
