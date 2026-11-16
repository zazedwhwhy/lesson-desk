import {useRef,useState} from 'react';
import type {Project} from '../core/model';

export function projectEdits(initial:Project,save:(p:Project)=>Promise<Project>,onPending:(pending:boolean)=>void){
 let current=initial,pending=0,tail:Promise<unknown>=Promise.resolve();
 return {
  sync(value:Project){if(!pending)current=value;},
  change(edit:(p:Project)=>void){
   const next=structuredClone(current);edit(next);current=next;
   pending++;onPending(true);
   const task=tail.then(()=>save(next));tail=task;
   return task.then(saved=>{if(pending===1)current=saved;return saved;}).finally(()=>{
    if(--pending===0){tail=Promise.resolve();onPending(false);}
   });
  }
 };
}

export function useProjectEdits(p:Project,save:(p:Project)=>Promise<unknown>){
 const [saving,setSaving]=useState(false),saveRef=useRef(save);saveRef.current=save;
 const editor=useRef<ReturnType<typeof projectEdits>|null>(null);
 if(!editor.current)editor.current=projectEdits(p,async next=>{
  const saved=await saveRef.current(next);if(!saved)throw Error('保存未完成，请重试');return saved as Project;
 },setSaving);
 editor.current.sync(p);
 return {saving,change:editor.current.change};
}
