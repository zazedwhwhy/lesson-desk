import {chemSlides} from '../core/chemistry';
import fs from 'node:fs/promises';
import pptxgen from 'pptxgenjs';
import {chineseSlides} from '../core/chinese';
import {buildLessonDeck,type LessonSelection} from '../core/lesson-deck';
import {bodyFontSize,layoutBlocks} from '../core/slide-layout';
import {defaultPptTemplate} from '../core/ppt-templates';
import {applyTemplate,type LoadedTemplate} from './ppt-templates';
import type {Project} from '../core/model';

export async function exportPpt(p:Project,file:string,selection:LessonSelection|string[],loaded:LoadedTemplate={template:defaultPptTemplate}){
 const {template,imported}=loaded,{layout,colors,fonts}=template;
 if(template.custom&&!imported)throw Error('自定义模板资源未加载，无法导出');
 const deck=p.subject==='chemistry'?chemSlides(p.chemistry!,selection as string[],layout):p.subject==='chinese'?chineseSlides(p.chinese!,selection as string[],layout):buildLessonDeck(p,selection as LessonSelection,layout);
 return exportLessonSlides(deck,p.title,p.subject,file,loaded);
}
export async function exportLessonSlides(deck:{title:string;section:string;kind:string;blocks:{label:string;text:string;emphasis?:boolean}[];image?:string}[],projectTitle:string,subject:string,file:string,loaded:LoadedTemplate={template:defaultPptTemplate}){
 const {template,imported}=loaded,{layout,colors,fonts}=template;
 const ppt=new pptxgen();ppt.defineLayout({name:'LESSON',width:layout.width,height:layout.height});ppt.layout='LESSON';
 ppt.author='讲题工作台';ppt.subject=subject==='chemistry'?'化学试卷讲解':subject==='chinese'?'语文试卷讲解':'英语试卷讲解';ppt.title=projectTitle;
 ppt.theme={headFontFace:fonts.heading,bodyFontFace:fonts.body};
 deck.forEach((s,i)=>{
  const slide=ppt.addSlide(),{body,title}=layout;
  slide.background={color:colors.background};
  if(title.y>=.36)slide.addText(s.section,{x:title.x,y:Math.max(.08,title.y-.32),w:title.w,h:.22,fontFace:fonts.body,fontSize:10,color:colors.muted,margin:0,fit:'shrink'});
  slide.addText(s.title,{...title,fontFace:fonts.heading,fontSize:28,color:colors.accent,margin:0,fit:'shrink',valign:'middle',breakLine:false});
  if(!template.custom)slide.addShape(ppt.ShapeType.line,{x:title.x,y:body.y-.24,w:body.w,h:0,line:{color:colors.line,width:1}});
  const image='image' in s?s.image:undefined;
  if(image)slide.addImage({data:image as string,...body,sizing:{type:'contain',w:body.w,h:body.h}});
  for(const b of layoutBlocks(s.blocks,layout,s.kind)){
   if(b.y+b.h>body.y+body.h+.001)throw Error(`第 ${i+1} 页内容超过模板正文区域，已停止导出`);
   if(b.label)slide.addText(b.label,{x:b.x,y:b.y,w:b.w,h:.22,fontFace:fonts.body,fontSize:11,color:colors.accent,bold:b.emphasis,margin:0,fit:'shrink'});
   slide.addText(b.text,{x:b.x,y:b.textY,w:b.w,h:b.textH,fontFace:subject!=='english'?fonts.body:['source','question','practice'].includes(s.kind)?fonts.source:fonts.body,fontSize:bodyFontSize(s.kind),color:b.emphasis?colors.accent:colors.text,margin:0,valign:'top',breakLine:false,lineSpacingMultiple:1.08});
  }
  if(layout.height-(body.y+body.h)>=.34){
   const y=layout.height-.32;
   if(!template.custom)slide.addShape(ppt.ShapeType.line,{x:title.x,y:y-.18,w:body.w,h:0,line:{color:colors.line,width:.7}});
   slide.addText(projectTitle,{x:body.x,y,w:body.w-1.2,h:.2,fontFace:fonts.body,fontSize:9,color:colors.muted,margin:0,fit:'shrink'});
   slide.addText(`${i+1} / ${deck.length}`,{x:body.x+body.w-1.1,y,w:1.1,h:.2,align:'right',fontFace:fonts.body,fontSize:9,color:colors.muted,margin:0});
  }
 });
 const bytes=new Uint8Array(await ppt.write({outputType:'arraybuffer'}) as ArrayBuffer);
 await fs.writeFile(file,imported?applyTemplate(bytes,imported):bytes);
 return deck.length;
}
