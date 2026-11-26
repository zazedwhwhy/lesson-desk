import React,{useEffect} from 'react';
import type {PptTemplate} from '../core/ppt-templates';
import {projectSlide,type ProjectedSlide} from '../core/ppt-page';
import type {Rect} from '../core/slide-layout';
import {MathSlideText} from './MathText';
import './ppt-templates.css';

type Props={slide:ProjectedSlide & {passageId?:string;questionId?:string;sourceVersionId?:string};template:PptTemplate;projectTitle:string;page:number;total:number;chinese?:boolean};
export function SlideDrawing({slide,template,projectTitle,page,total,chinese}:Props){
 const {width,height}=template.layout;
 const geometry=(r:Rect):React.CSSProperties=>({position:'absolute',left:r.x/width*100+'%',top:r.y/height*100+'%',width:r.w/width*100+'%',height:r.h/height*100+'%'});
 return <>{projectSlide(slide,template,projectTitle,page,total,!chinese).map((item,i)=>{
  const rect=geometry(item);
  if(item.type==='rect')return <span aria-hidden="true" key={i} style={{...rect,background:'#'+item.color}}/>;
  if(item.type==='image')return <img key={i} style={{...rect,objectFit:'contain'}} src={item.data} alt={item.alt}/>;
  const heading=item.role==='title'||item.role==='label';
  return <span key={i} className={item.role==='body'?'ppt-slide-block':undefined} role={heading?'heading':undefined} aria-level={heading?(item.role==='title'?1:2):undefined}
    style={{...rect,fontFamily:item.font+", 'Microsoft YaHei', sans-serif",fontSize:item.pt/(width*72)*100+'cqw',fontWeight:item.bold?700:400,
     color:'#'+item.color,textAlign:item.align||'left',whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.25}}>
    {item.math?<MathSlideText text={item.text} width={item.w} fontSize={item.pt} color={'#'+item.color}/>:item.text}
   </span>;
 })}</>;
}
export function LessonSlideView(props:Props){
 useEffect(()=>{window.scrollTo(0,0);},[]);
 const {slide,template}=props,{width,height}=template.layout;
 return <main data-source-version={slide.sourceVersionId} data-source-passage={slide.passageId} data-source-question={slide.questionId} data-source-module={slide.kind}
  className="slide ppt-slide-view" data-screen-label="课件放映" style={{width:`min(1200px, calc((100dvh - 150px) * ${width/height}), calc(100vw - 40px))`,aspectRatio:`${width}/${height}`,background:'#'+template.colors.background}}>
  <SlideDrawing {...props}/>
 </main>;
}
