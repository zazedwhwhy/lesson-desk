import React,{useEffect,useState} from 'react';
import type {TaskTiming} from '../core/task-timing';
export function TaskProgressLabel({task,active=true}:{task:TaskTiming&{state:string};active?:boolean}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(task.state!=='running'||!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[task.state,active]);
 const elapsed=task.startedAt?Math.max(0,Math.floor(((task.finishedAt??now)-task.startedAt)/1000)):undefined;
 const phase={generating:'正在生成',reviewing:'正在复核',retrying:'正在重试',saving:'正在保存'};
 const label=task.state==='running'?(active?phase[task.phase||'generating']:'未完成'):({pending:'等待执行',complete:'已保存',failed:'失败'}[task.state]||task.state);
 return <span>{label}{elapsed!==undefined&&` · ${Math.floor(elapsed/60)}分${elapsed%60}秒`}</span>;
}
