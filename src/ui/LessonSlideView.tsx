import React,{useEffect} from 'react';
import type {PptTemplate} from '../core/ppt-templates';
import {bodyFontSize,layoutBlocks,type Rect,type SlideBlock} from '../core/slide-layout';
import './ppt-templates.css';

type Props={slide:{title:string;section:string;kind:string;blocks:SlideBlock[];image?:string;passageId?:string;questionId?:string;sourceVersionId?:string};template:PptTemplate;projectTitle:string;page:number;total:number;chinese?:boolean};
export function LessonSlideView({slide:s,template:t,projectTitle,page,total,chinese}:Props){
 useEffect(()=>{window.scrollTo(0,0);},[]);
 const {layout:l,colors:c,fonts:f}=t;
 const rect=(r:Rect):React.CSSProperties=>({position:'absolute',left:r.x/l.width*100+'%',top:r.y/l.height*100+'%',width:r.w/l.width*100+'%',height:r.h/l.height*100+'%'});
 const size=(pt:number)=>pt/(l.width*72)*100+'cqw';
 const titleSize=Math.min(28,Math.max(16,l.title.w*72/Math.max(1,[...s.title].reduce((n,c)=>n+(/[^\u0000-\u007f]/.test(c)?1:.55),0))*1.7));
 return <main data-source-version={s.sourceVersionId} data-source-passage={s.passageId} data-source-question={s.questionId} data-source-module={s.kind} className="slide ppt-slide-view" data-screen-label="课件放映" style={{width:`min(1200px, calc((100vh - 280px) * ${l.width/l.height}), calc(100vw - 40px))`,aspectRatio:`${l.width}/${l.height}`,background:'#'+c.background,color:'#'+c.text}}>
  {l.title.y>=.36&&<div className="ppt-slide-section" style={{...rect({x:l.title.x,y:Math.max(.08,l.title.y-.32),w:l.title.w,h:.22}),fontSize:size(10),color:'#'+c.muted,fontFamily:f.body}}>{s.section}</div>}
  <h1 style={{...rect(l.title),fontSize:size(titleSize),fontFamily:f.heading,color:'#'+c.accent}}>{s.title}</h1>
  {s.image?<img style={{...rect(l.body),objectFit:'contain'}} src={s.image} alt={s.title+'原页'}/>:layoutBlocks(s.blocks,l,s.kind).map((b,i)=><section className="ppt-slide-block" key={i} style={{...rect(b),fontFamily:chinese?f.body:['source','question','practice'].includes(s.kind)?f.source:f.body}}>
   {b.label&&<h2 style={{fontFamily:f.body,fontSize:size(11),color:'#'+c.accent,height:.22/l.width*100+'cqw',marginBottom:.07/l.width*100+'cqw'}}>{b.label}</h2>}
   <p style={{fontSize:size(bodyFontSize(s.kind)),color:'#'+(b.emphasis?c.accent:c.text),height:b.textH/l.width*100+'cqw'}}>{b.text}</p>
  </section>)}
  {l.height-(l.body.y+l.body.h)>=.34&&<footer style={{...rect({x:l.body.x,y:l.height-.32,w:l.body.w,h:.2}),fontSize:size(9),color:'#'+c.muted}}><span>{projectTitle}</span><span>{page} / {total}</span></footer>}
 </main>;
}
