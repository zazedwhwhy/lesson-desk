import type {PptTemplate} from './ppt-templates';
import {bodyFontSize, labelFontSize, layoutBlocks, wrapSlideText, type Rect, type SlideBlock} from './slide-layout';
import type {QuestionLayout} from './question-layout';
import {FormulaWidthError,hasMath} from './math-text';

export type ProjectedSlide = {title:string; section:string; kind:string; blocks:SlideBlock[]; image?:string;questionLayout?:QuestionLayout};
type TextRole = 'title'|'section'|'project'|'folio'|'label'|'body';
type TextItem = Rect & {
 type:'text'; role:TextRole; text:string; font:string; pt:number; color:string;
 bold?:boolean; math?:boolean; align?:'right'; fit?:boolean;
};
export type PageItem = TextItem | (Rect & {type:'rect';color:string}) | (Rect & {type:'image';data:string;alt:string});

function frameFont(text:string,box:Rect,fontSize:number) {
 let size=fontSize;
 while(size>10 && wrapSlideText(text,box.w*72/size*.91).length*size/72*1.25>box.h) size--;
 return size;
}

// Page geometry is expressed in inches, type in points. Both renderers consume these items in order.
export function projectSlide(slide:ProjectedSlide, template:PptTemplate, project:string, page:number, total:number, english:boolean):PageItem[] {
 const {layout,colors,fonts}=template;
 const {body,title,width,height}=layout;
 const items:PageItem[]=[];
 const box=(x:number,y:number,w:number,h:number):Rect=>({x,y,w,h});
 const fill=(r:Rect,color:string)=>items.push({...r,type:'rect',color});
 function text(role:TextRole,value:string,r:Rect,pt:number,color:string,font=fonts.body,extra:Partial<Pick<TextItem,'bold'|'align'|'fit'|'math'>>={}) {
  if(value)items.push({...r,type:'text',role,text:value,pt:extra.fit?frameFont(value,r,pt):pt,color,font,...extra});
 }
 const folio=page+' / '+total;
 const paper=!template.custom && template.id==='paper';
 const blue=!template.custom && template.id==='blue';
 const mint=!template.custom && template.id==='forest';
 if(blue){
  fill(box(0,0,width,1.0),colors.accent);
  fill(box(.31,.24,.10,.52),'F4CB36');
  text('title',slide.title,title,31,'FFFFFF',fonts.heading,{bold:true,fit:true});
  text('section',slide.section,box(8.8,.32,3.8,.49),16,'FFFFFF',fonts.body,{align:'right',fit:true});
 }else if(mint){
  fill(box(0,0,.14,height),'9ACBB4');
  fill(box(.40,1.06,width-.8,5.96),'FFFFFF');
  fill(box(.74,1.04,.86,.06),colors.accent);
  text('title',slide.title,title,32,colors.accent,fonts.heading,{bold:true,fit:true});
  text('section',slide.section,box(8.8,.40,3.76,.44),16,colors.muted,fonts.body,{align:'right',fit:true});
 }else if(paper){
  text('title',slide.title,title,32,colors.accent,fonts.heading,{bold:true,fit:true});
  text('section',slide.section,box(8.8,.43,3.80,.44),15,colors.muted,fonts.body,{align:'right',fit:true});
  fill(box(body.x,1.00,body.w,.016),colors.line);
 }else{
  if(title.y>=.36)text('section',slide.section,box(title.x,Math.max(.08,title.y-.32),title.w,.24),10,colors.muted,fonts.body,{fit:true});
  text('title',slide.title,title,28,colors.accent,fonts.heading,{fit:true});
 }
 if(height-body.y-body.h>=.34){
  const y=template.custom?height-.32:7.10;
  text('project',project,box(body.x,y,body.w-1.25,.27),template.custom?9:11,colors.muted,fonts.body,{fit:true});
  text('folio',folio,box(body.x+body.w-1.18,y,1.18,.28),template.custom?9:12,colors.muted,fonts.body,{align:'right',fit:true});
 }
 if(slide.questionLayout){
  const {parts,figure}=slide.questionLayout;
  const face=english?fonts.source:fonts.body;
  parts.forEach((part,index)=>{
   const block=slide.blocks[index];
   text('body',block.text,part,part.pt,colors.text,face,{bold:part.stem,math:!!block.math && hasMath(block.text)});
  });
  if(figure)items.push({...figure.box,type:'image',data:figure.data,alt:figure.name+(figure.page?' · 原材料第 '+figure.page+' 页':'')});
  return items;
 }
 if(slide.image && slide.blocks.length)throw Error('第 '+page+' 页同时含有原图与正文，请分为题图页和文字页');
 if(slide.image){
  items.push({...body,type:'image',data:slide.image,alt:slide.title});
  return items;
 }
 let pt=bodyFontSize(slide.kind,layout);
 let blocks=layoutBlocks(slide.blocks,layout,slide.kind,pt);
 if(!blocks.length)return items;
 const used=(pageBlocks:typeof blocks)=>{
  const last=pageBlocks[pageBlocks.length-1];
  return last.y+last.h-body.y;
 };
 if(used(blocks)>body.h+.001)throw Error('第 '+page+' 页内容超过模板正文区域，请重新编排');
 // Enlarge a sparse page only when the entire original group still fits at the new measure.
 if(layout.classroom && used(blocks)<body.h*.72){
  const single=blocks.length===1 && blocks[0].emphasis && !blocks[0].math
    && Array.from(blocks[0].text.trim()).length<=12 && !blocks[0].text.includes('\n');
  const maximum=single ? 34 : 29;
  for(let candidate=maximum;candidate>pt;candidate--){
   let enlarged:typeof blocks;
   try{enlarged=layoutBlocks(slide.blocks,layout,slide.kind,candidate);}
   catch(error){if(error instanceof FormulaWidthError)continue;throw error;}
   if(used(enlarged)<=body.h*.84){blocks=enlarged;pt=candidate;break;}
  }
 }
 const space=Math.max(0,body.h-used(blocks));
 const offset=layout.classroom ? Math.min(.22,space*.10) : 0;
 for(const b of blocks){
  const ink=b.emphasis?colors.accent:colors.text;
  if(layout.classroom && b.emphasis)fill(box(b.x-.19,b.y+offset+.035,.05,Math.max(.22,b.h-.08)),colors.accent);
  if(b.label)text('label',b.label,box(b.x,b.y+offset,b.w,b.labelH),labelFontSize(layout),colors.accent,fonts.body,{bold:true});
  const face=english && ['source','question','practice'].includes(slide.kind)?fonts.source:fonts.body;
  text('body',b.text,box(b.x,b.textY+offset,b.w,b.textH),pt,ink,face,
    {bold:b.emphasis,math:!!b.math&&hasMath(b.text)});
 }
 return items;
}
