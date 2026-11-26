import {hasMath,mathLines} from './math-text';
// Inches, shared by compilation, page counts and the editable PPT renderer.
export type SlideBlock = {label:string;text:string;emphasis?:boolean;math?:boolean};
export type Rect = {x:number;y:number;w:number;h:number};
export type SlideLayout = {width:number;height:number;classroom?:boolean;sequence?:'steps';body:Rect;title:Rect};
export const defaultSlideLayout:SlideLayout = {width:13.333333,height:7.5,classroom:true,body:{x:.94,y:1.67,w:11.45,h:5.05},title:{x:.92,y:.68,w:11.5,h:.73}};
export function bodyFontSize(kind:string, layout=defaultSlideLayout) {
 const reading=['source','question','practice'].includes(kind);
 return layout.classroom ? (reading ? 26 : 23) : (reading ? 22 : 19);
}
export const labelFontSize=(layout:SlideLayout)=>layout.classroom?16:11;
const gap=.16;
const unit=(c:string)=>/[^\u0000-\u007f]/u.test(c)?1:.55;

// Keep the exact input, including whitespace. Latin words wrap as a unit when possible.
export function wrapSlideText(text:string,columns:number):string[]{
 const result:string[]=[];let line='',width=0;
 const flush=()=>{result.push(line);line='';width=0;};
 for(const token of text.match(/\n|[^\S\n]+|[a-zA-Z0-9'’-]+|./gu)||[]){
  if(token==='\n'){line+=token;flush();continue;}
  const tokenWidth=[...token].reduce((n,c)=>n+unit(c),0);
  if(width&&width+tokenWidth>columns&&tokenWidth<=columns)flush();
  for(const c of token){if(width&&width+unit(c)>columns)flush();line+=c;width+=unit(c);}
 }
 if(line||!result.length)result.push(line);
 return result;
}
function metrics(layout:SlideLayout,kind:string,fontSize=bodyFontSize(kind,layout)){
 return {lineHeight:fontSize/72*1.32,columns:layout.body.w*72/fontSize*.91};
}
function labelHeight(label:string,layout:SlideLayout){
 if(!label)return 0;
 const size=labelFontSize(layout);
 return wrapSlideText(label,layout.body.w*72/size*.9).length*size/72*1.3+.07;
}
export function blockHeight(block:SlideBlock,layout=defaultSlideLayout,kind='analysis',fontSize=bodyFontSize(kind,layout)){
 const m=metrics(layout,kind,fontSize);
 return labelHeight(block.label,layout)+(block.math&&hasMath(block.text)?mathLines(block.text,layout.body.w,fontSize).reduce((h,l)=>h+l.h,0):wrapSlideText(block.text,m.columns).length*m.lineHeight)+.07;
}
export function layoutBlocks(blocks:SlideBlock[],layout=defaultSlideLayout,kind='analysis',fontSize=bodyFontSize(kind,layout)){
 let y=layout.body.y;
 return blocks.map(block=>{
  const h=blockHeight(block,layout,kind,fontSize),labelH=labelHeight(block.label,layout);
  const rect={...block,x:layout.body.x,y,w:layout.body.w,h,labelH,textY:y+labelH,textH:h-labelH};
  y+=h+gap;return rect;
 });
}
function pack(input:SlideBlock[],layout:SlideLayout,kind:string,height:number):SlideBlock[][]{
 const pages:SlideBlock[][]=[];let page:SlideBlock[]=[],used=0;
 const m=metrics(layout,kind);
 const flush=()=>{if(page.length)pages.push(page);page=[];used=0;};
 for(const item of input){
  if(!item.text.trim())continue;
  let remaining=item.text,continued=false;
  if(page.length&&blockHeight(item,layout,kind)<=height&&used+gap+blockHeight(item,layout,kind)>height)flush();
  while(remaining){
   const label=item.label+(continued&&item.label&&!item.label.endsWith('（续）')?'（续）':'');
   const room=height-used-(page.length?gap:0)-labelHeight(label,layout)-.07;
   const math=item.math&&hasMath(remaining)?mathLines(remaining,layout.body.w,bodyFontSize(kind,layout)):undefined;
   let count=Math.floor((room+.00001)/m.lineHeight);
   if(math){count=0;let used=0;for(const line of math){if(used+line.h>room+.00001)break;used+=line.h;count++;}if(!count&&!page.length)throw Error('公式高度超出页面，请拆分公式或使用更大的模板');}
   const wrapped=math?math.map(l=>l.raw):wrapSlideText(remaining,m.columns);
   if(count<1&&!page.length)throw Error('模板正文区域无法同时放入标签和一行内容，请扩大正文空间');
   if(count<1||(page.length&&count<2&&wrapped.length>count)){flush();continue;}
   const text=wrapped.slice(0,count).join('');
   if(!text)throw Error('模板正文区域太小，无法放入一行内容');
   const block={...item,label,text};
   used+=(page.length?gap:0)+blockHeight(block,layout,kind);page.push(block);
   remaining=remaining.slice(text.length);continued=true;
   if(remaining)flush();
  }
 }
 flush();return pages;
}
export function paginateBlocks(input:SlideBlock[],layout=defaultSlideLayout,kind='analysis'):SlideBlock[][]{
 const prepared=input.map(b=>/^(?:参考答案|答案|核心结论|关键步骤|解题关键|句子主干)(?:$|（续）)/.test(b.label)?{...b,emphasis:true}:b);
 if(layout.sequence==='steps'&&prepared.length>1&&!['source','practice','question'].includes(kind)){
  return prepared.flatMap(block=>paginatePage([block],layout,kind));
 }
 return paginatePage(prepared,layout,kind);
}
function paginatePage(input:SlideBlock[],layout=defaultSlideLayout,kind='analysis'):SlideBlock[][]{
 const m=metrics(layout,kind);
 if(layout.body.h<labelHeight('文',layout)+m.lineHeight+.07||layout.body.w<2)throw Error('模板正文区域太小，请使用正文空间更大的模板');
 const pages=pack(input,layout,kind,layout.body.h);
 if(pages.length<2)return pages;
 const cost=(page:SlideBlock[])=>page.reduce((n,b)=>n+blockHeight(b,layout,kind),0)+Math.max(0,page.length-1)*gap;
 if(cost(pages[pages.length-1])>=layout.body.h*.38)return pages;
 // Repack only the last two pages at the smallest capacity that still fits two pages.
 if(input.some(b=>b.math&&hasMath(b.text)))return pages;
 const tail=pages.slice(-2).flat();
 const tallestLabel=Math.max(...tail.map(b=>labelHeight(b.label+'（续）',layout)));
 let low=tallestLabel+m.lineHeight*2+.07,high=layout.body.h,best=pages.slice(-2);
 for(let i=0;i<10;i++){
  const target=(low+high)/2,next=pack(tail,layout,kind,target);
  if(next.length<=2){best=next;high=target;}else low=target;
 }
 return [...pages.slice(0,-2),...best];
}
