import React,{useEffect,useRef,useState} from 'react';

// Keep the teacher's current edit when a different field finishes saving.
export function AutosaveTextarea({value,onCommit,...props}:Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'defaultValue'|'onChange'|'onBlur'> & {value:string;onCommit:(value:string)=>Promise<unknown>}){
 const [draft,setDraft]=useState(value),edited=useRef(false),latest=useRef(value);
 useEffect(()=>{if(!edited.current){setDraft(value);latest.current=value;}},[value]);
 return <textarea {...props} value={draft} onChange={e=>{edited.current=true;latest.current=e.target.value;setDraft(e.target.value);}} onBlur={async()=>{
  const text=latest.current;if(!edited.current)return;if(text===value){edited.current=false;return;}
  const saved=await onCommit(text);
  if(saved&&latest.current===text)edited.current=false;
 }}/>;
}
