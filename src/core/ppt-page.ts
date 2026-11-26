import type {PptTemplate} from './ppt-templates';
import {bodyFontSize, labelFontSize, layoutBlocks, wrapSlideText, type Rect, type SlideBlock} from './slide-layout';
import {hasMath} from './math-text';

export type ProjectedSlide = {title:string; section:string; kind:string; blocks:SlideBlock[]; image?:string};
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
 const cinema=!template.custom && template.id==='forest';
 if(blue) {
  fill(box(0,0,3.46,height),colors.accent);
  fill(box(.45,.52,.62,.13),'F4CB36');
  text('section',slide.section,box(.45,.86,2.62,.54),15,'FFFFFF',fonts.body,{fit:true});
  text('title',slide.title,title,34,'FFFFFF',fonts.heading,{bold:true,fit:true});
  fill(box(.45,5.93,2.55,.018),'91A9E8');
  text('project',project,box(.45,6.12,2.57,.53),13,'FFFFFF',fonts.body,{fit:true});
  text('folio',folio,box(.45,6.82,2.56,.36),17,'FADD68',fonts.body,{bold:true});
 } else if(cinema) {
  fill(box(0,6.16,width,1.34),'202A3C');
  fill(box(.94,.44,.42,.07),'99B4FF');
  text('section',slide.section,box(1.54,.31,10.82,.49),15,colors.muted,fonts.body,{fit:true});
  text('title',slide.title,title,29,colors.text,fonts.heading,{bold:true,fit:true});
  text('folio',folio,box(11.34,6.52,1.05,.38),15,colors.accent,fonts.body,{align:'right'});
 } else {
  const section=paper?box(title.x,.23,title.w,.4):box(title.x,Math.max(.08,title.y-.32),title.w,.24);
  if(paper||title.y>=.36)text('section',slide.section,section,paper?14:10,colors.muted,fonts.body,{fit:true});
  text('title',slide.title,title,paper?34:28,colors.accent,fonts.heading,{bold:paper,fit:true});
  if(paper)fill(box(body.x,1.47,body.w,.017),colors.line);
  if(height-body.y-body.h>=.34) {
   const y=paper?6.97:height-.32;
   if(paper)fill(box(body.x,6.86,body.w,.012),colors.line);
   text('project',project,box(body.x,y,body.w-1.2,paper ? .32 : .22),paper?12:9,colors.muted,fonts.body,{fit:true});
   text('folio',folio,box(body.x+body.w-1.15,y,1.15,.32),paper?13:9,colors.muted,fonts.body,{align:'right'});
  }
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
  const maximum=single ? (cinema?67:46) : (cinema?35:33);
  for(let candidate=maximum;candidate>pt;candidate--){
   const enlarged=layoutBlocks(slide.blocks,layout,slide.kind,candidate);
   if(used(enlarged)<=body.h*.84){blocks=enlarged;pt=candidate;break;}
  }
 }
 const space=Math.max(0,body.h-used(blocks));
 const offset=layout.classroom ? space*(cinema ? .45 : blue ? .28 : .16) : 0;
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
