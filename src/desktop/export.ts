import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {imageSize} from 'image-size';
import pptxgen from 'pptxgenjs';
import {mathLines} from '../core/math-text';
import {chemSlides} from '../core/chemistry';
import {chineseSlides} from '../core/chinese';
import {buildLessonDeck,type LessonSelection} from '../core/lesson-deck';
import {defaultPptTemplate} from '../core/ppt-templates';
import {projectSlide,type ProjectedSlide,type PageItem} from '../core/ppt-page';
import {applyTemplate,type LoadedTemplate} from './ppt-templates';
import {withFormulaPreviews} from './ppt-formula-preview';
import {atomicRename} from './atomic-rename';
import type {Project} from '../core/model';

export async function exportPpt(p:Project,file:string,selection:LessonSelection|string[],loaded:LoadedTemplate={template:defaultPptTemplate}){
 const {layout}=loaded.template;
 const deck=p.subject==='chemistry'?chemSlides(p.chemistry!,selection as string[],layout)
   :p.subject==='chinese'?chineseSlides(p.chinese!,selection as string[],layout):buildLessonDeck(p,selection as LessonSelection,layout);
 return exportLessonSlides(deck,p.title,p.subject,file,loaded);
}

function drawItem(slide:pptxgen.Slide,item:PageItem){
 const {x,y,w,h}=item;
 if(item.type==='rect'){
  slide.addShape('rect',{x,y,w,h,line:{type:'none'},fill:{color:item.color},objectName:'版面'});
  return;
 }
 if(item.type==='image'){
  const {width,height}=imageSize(Buffer.from(item.data.slice(item.data.indexOf(',')+1),'base64'));
  const scale=Math.min(w/width,h/height);
  slide.addImage({data:item.data,x:x+(w-width*scale)/2,y:y+(h-height*scale)/2,w:width*scale,h:height*scale,altText:item.alt});
  return;
 }
 const {pt,color,font}=item;
 if(item.math){
  let top=y;
  for(const row of mathLines(item.text,w,pt)){
   for(const run of row.runs){
    const box={x:x+run.x,y:top+(row.h-run.h)/2,w:run.w,h:run.h};
    if(run.formula){
     const svg=run.formula.svg.replace(/currentColor/g,'#'+color).replace(/width="[^"]+"/,`width="${run.w*144}px"`).replace(/height="[^"]+"/,`height="${run.h*144}px"`);
     slide.addImage({data:'image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),...box,altText:run.raw});
    } else if(run.text.trim()){
     slide.addText(run.text,{...box,fontFace:font,fontSize:pt,color,bold:item.bold,margin:0,valign:'middle'});
    }
   }
   top+=row.h;
  }
  return;
 }
 slide.addText(item.text,{x,y,w,h,fontFace:font,fontSize:pt,color,bold:item.bold,margin:0,
  align:item.align,valign:'top',lineSpacingMultiple:1.02,paraSpaceAfter:0,paraSpaceBefore:0,
  fit:item.fit?'shrink':undefined,objectName:item.role==='title'?item.text:item.role});
}

export async function exportLessonSlides(deck:ProjectedSlide[],projectTitle:string,subject:string,file:string,loaded:LoadedTemplate={template:defaultPptTemplate}){
 const {template,imported}=loaded,{layout,colors,fonts}=template;
 if(template.custom&&!imported)throw Error('自定义模板资源未加载，无法导出');
 if(!deck.length)throw Error('所选范围没有可导出的幻灯片');
 const ppt=new pptxgen();
 ppt.defineLayout({name:'LESSON',width:layout.width,height:layout.height});
 ppt.layout='LESSON';ppt.author='讲题工作台';ppt.title=projectTitle;
 ppt.subject=subject==='chemistry'?'化学试卷讲解':subject==='chinese'?'语文试卷讲解':'英语试卷讲解';
 ppt.theme={headFontFace:fonts.heading,bodyFontFace:fonts.body};
 for(const [i,s] of deck.entries()){
  const slide=ppt.addSlide();
  slide.background={color:colors.background};
  for(const item of projectSlide(s,template,projectTitle,i+1,deck.length,subject==='english'))drawItem(slide,item);
 }
 const bytes=await withFormulaPreviews(new Uint8Array(await ppt.write({outputType:'arraybuffer'}) as ArrayBuffer));
 const output=imported?applyTemplate(bytes,imported):bytes;
 const temporary=file+'.'+randomUUID()+'.tmp';
 try{
  await fs.writeFile(temporary,output);
  await atomicRename(temporary,file);
 }finally{await fs.rm(temporary,{force:true});}
 return deck.length;
}
