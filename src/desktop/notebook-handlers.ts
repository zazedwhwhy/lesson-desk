import path from 'node:path';
import {dialog,type BrowserWindow} from 'electron';
import {NotebookStore} from './notebook';
import {exportNotebook} from './notebook-output';
import {outputSchema,notebookDeck} from '../core/notebook';
import {notebookSources,notebookExcerptSource} from '../core/notebook-source';
import type {Store} from './store';

export function registerNotebook(handle:(name:string,fn:(...args:any[])=>any)=>void,root:string,store:Store,window:()=>BrowserWindow){
 const notebook=new NotebookStore(path.join(root,'notebook.json'));
 handle('notebook-list',(all=false)=>notebook.list(all));
 handle('notebook-update',(entry:unknown)=>notebook.update(entry));
 handle('notebook-source',async(id:string)=>{
  const entry=(await notebook.list(true)).find(e=>e.id===id);if(!entry)throw Error('条目已不存在');
  if(!entry.sourceId&&!entry.sourceRef)throw Error('旧片段没有来源定位，请从原课件重新收录');
  const p=await store.load(entry.projectId,false);if(entry.kind==='excerpt')return notebookExcerptSource(p,entry);
  const source=notebookSources(p).find(q=>q.id===entry.sourceId);if(!source)throw Error('原题已不存在；保留当前快照');return source;
 });
 handle('notebook-output',async(raw:unknown)=>{
  const o=outputSchema.parse(raw),entries=await notebook.list();notebookDeck(entries,o);
  const target=await dialog.showSaveDialog(window(),{defaultPath:'错题专题复习.'+o.format,filters:[{name:o.format.toUpperCase(),extensions:[o.format]}]});
  if(target.canceled||!target.filePath)return null;return exportNotebook(entries,o,target.filePath);
 });
 handle('notebook-add',(entry:unknown)=>notebook.add(entry));
 handle('notebook-remove',(id:string)=>notebook.remove(id));
}
