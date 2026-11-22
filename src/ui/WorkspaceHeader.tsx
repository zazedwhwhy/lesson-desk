import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, BookOpen, ChevronDown, Maximize, Settings, SlidersHorizontal} from 'lucide-react';
import {notebookBeta} from '../core/release-channel';

type Props = {
  notebookTools?: React.ReactNode;
  translationLabel?: string;
  title?: string;
  screen: string;
  busy: boolean;
  font: number;
  mode: string;
  translated: boolean;
  setFont: (font:number) => void;
  setMode: (mode:string) => void;
  setTranslated: (show:boolean) => void;
  home: () => void;
  navigate: (screen:'review'|'teach') => void;
  arrange: () => void;
  fullscreen: () => void;
  answers: () => void;
  settings: () => void;
};
const stages = [['review','备课材料'], ['teach','教学讲义'], ['lesson-setup','授课与导出']] as const;

export function WorkspaceHeader(p:Props) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const doc=Boolean(p.title)&&stages.some(([screen])=>screen===p.screen);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',escape);
    return ()=>{
      document.removeEventListener('pointerdown',close);
      document.removeEventListener('keydown',escape);
    };
  },[open]);
  useEffect(()=>setOpen(false),[p.screen]);
  return <header className="workspace-header" data-screen-label="工作区工具栏">
    <div className="document-location">
      {doc ? <>
        <button className="library-link" onClick={p.home} disabled={p.busy}><ArrowLeft size={16}/>课件库</button>
        <span className="location-divider" aria-hidden="true">/</span><h1 title={p.title}>{p.title}</h1>
      </> : <div className="product-title"><BookOpen size={21}/><span>讲题工作台{notebookBeta?' Beta':''}</span></div>}
    </div>
    <nav className="workspace-actions" aria-label="课件操作">
      {doc&&<div className="stage-nav paper-tabs" role="group" aria-label="课件流程">
        {stages.map(([stage,label])=><button key={stage} aria-current={stage===p.screen?'page':undefined}
          disabled={p.busy} onClick={()=>{
            if(stage===p.screen)return;
            if(stage==='lesson-setup')p.arrange();else p.navigate(stage);
          }}>{label}</button>)}
      </div>}
      {p.screen==='teach'&&<div className="reading-menu" ref={ref}>
        <button className={'reading-trigger '+(open?'is-open':'')} aria-expanded={open} aria-controls="reading-options" onClick={()=>setOpen(!open)}>
        <SlidersHorizontal size={15}/>阅读设置<ChevronDown size={13}/>
        </button>{open&&<section className="reading-options" id="reading-options" aria-label="阅读设置">
        <div className="options-heading">阅读设置<button aria-label="关闭阅读设置" onClick={()=>setOpen(false)}>收起</button>
        </div>
        <fieldset>
        <legend>页面内容</legend>
        <div className="view-choices paper-tabs">{[['original','读原文'],['compare','对读'],['analysis','看讲义']].map(([value,label])=>
        <button key={value} aria-pressed={p.mode===value} onClick={()=>p.setMode(value)}>{label}</button>)}</div>
        </fieldset>
        <label className="font-setting">
        <span>正文字号 <output>{p.font} px</output>
        </span>
        <input aria-label="字号" type="range" min="22" max="48" value={p.font} onChange={e=>p.setFont(+e.target.value)}/>
        </label>
        <label className="translation-setting">
        <span>{p.translationLabel||'附中文译文'}</span>
        <input type="checkbox" checked={p.translated} onChange={e=>p.setTranslated(e.target.checked)}/>
        </label>
        <div className="options-links">
        <button onClick={()=>{p.answers();setOpen(false);}}>答案索引</button>
        <button onClick={()=>{p.fullscreen();setOpen(false);}}>
        <Maximize size={14}/>专注阅读</button>
        </div>
        </section>}</div>}
      {p.notebookTools}
      {p.screen!=='settings'&&p.screen!=='prompts'&&<button className="quiet-action" disabled={p.busy} onClick={p.settings} aria-label="连接设置">
        <Settings size={16}/>{!doc&&'连接设置'}
      </button>}
    </nav>
  </header>;
}
