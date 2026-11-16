import React,{useEffect,useState} from 'react';
import {ArrowLeft,ChevronLeft,ChevronRight,Maximize} from 'lucide-react';
import {LessonSlideView} from './LessonSlideView';
import type {PptTemplate} from '../core/ppt-templates';
import type {LessonSlide} from '../core/lesson-deck';
import type {ChemSlide} from '../core/chemistry';
import type {ChineseSlide} from '../core/chinese';

export function PresentationView({deck,template,title,chinese=false,back,fullscreen}:{deck:(LessonSlide|ChineseSlide|ChemSlide)[];template:PptTemplate;title:string;chinese?:boolean;back:()=>void;fullscreen:()=>void}){
 const [page,setPage]=useState(0);
 const index=Math.min(page,Math.max(0,deck.length-1));
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes((e.target as HTMLElement).tagName))return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();setPage(i=>Math.min(deck.length-1,i+1));}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();setPage(i=>Math.max(0,i-1));}if(e.key==='Escape')back();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[deck.length,back]);
 if(!deck.length)return <main className="empty"><h1>暂无可放映内容</h1><button onClick={back}>返回编排</button></main>;
 return <div className="show-screen"><div className="show-tools"><button onClick={back}><ArrowLeft size={17}/>返回编排</button><span>{index+1} / {deck.length}</span><select aria-label="跳转页面" value={index} onChange={e=>setPage(+e.target.value)}>{deck.map((s,i)=><option key={s.id} value={i}>{i+1} {s.title}</option>)}</select><button onClick={fullscreen}><Maximize size={17}/>全屏</button></div><LessonSlideView slide={deck[index]} template={template} projectTitle={title} page={index+1} total={deck.length} chinese={chinese}/><nav className="slide-nav"><button disabled={!index} onClick={()=>setPage(index-1)}><ChevronLeft size={17}/>上一页</button><button disabled={index===deck.length-1} onClick={()=>setPage(index+1)}>下一页<ChevronRight size={17}/></button></nav></div>;
}
