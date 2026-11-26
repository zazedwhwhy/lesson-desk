import {FormulaWidthError,hasMath,mathLines} from './math-text';
import {paginateBlocks,splitQuestionBlock,wrapSlideText,type Rect,type SlideBlock,type SlideLayout} from './slide-layout';

export type QuestionFigure={data:string;name:string;page?:number};
export type QuestionLayout={
 parts:(Rect & {pt:number;stem?:boolean})[];
 figure?:QuestionFigure & {box:Rect};
};
export type QuestionPage={blocks:SlideBlock[];questionLayout?:QuestionLayout};

function questionHeight(block:SlideBlock,width:number,pt:number) {
 if(block.math && hasMath(block.text)){
  try{return mathLines(block.text,width,pt).reduce((sum,row)=>sum+row.h,0)+.06;}
  catch(e){if(e instanceof FormulaWidthError)return Infinity;throw e;}
 }
 return wrapSlideText(block.text,width*72/pt*.93).length*pt/72*1.32+.07;
}

function fitQuestion(blocks:SlideBlock[],body:Rect,figure?:QuestionFigure,hasStem=true):QuestionLayout|undefined {
 const figureWidth=figure?body.w*.34:0;
 const width=figure?body.w-figureWidth-.38:body.w;
 const options=hasStem?blocks.slice(1):blocks;
 // At each size, compare a full-width list and row-major pairs before considering smaller type.
 for(let pt=27;pt>=21;pt--){
  const stemPt=pt+1;
  const stemHeight=hasStem?questionHeight(blocks[0],width,stemPt):0;
  if(stemHeight>body.h)continue;
  let best:QuestionLayout['parts']|undefined;
  let bestHeight=Infinity;
  const columns=options.length>=4 && !figure ? [1,2] : [1];
  for(const count of columns){
   const gutter=.42, optionWidth=(width-(count-1)*gutter)/count;
   const parts:QuestionLayout['parts']=hasStem?[{x:body.x,y:body.y,w:width,h:stemHeight,pt:stemPt,stem:true}]:[];
   let used=stemHeight;
   for(let i=0;i<options.length;i+=count){
    if(i>0)used+=.12;
    else if(hasStem)used+=.24;
    const row=options.slice(i,i+count).map((option,col)=>({
     x:body.x+col*(optionWidth+gutter),y:body.y+used,w:optionWidth,h:questionHeight(option,optionWidth,pt),pt,
    }));
    parts.push(...row);
    used+=Math.max(...row.map(item=>item.h));
   }
   // Prefer the natural single-column reading order when pairs save less than half a line.
   if(used<=body.h && used<bestHeight-.2){best=parts;bestHeight=used;}
  }
  if(best){
   const layout:QuestionLayout={parts:best};
   if(figure)layout.figure={...figure,box:{x:body.x+body.w-figureWidth,y:body.y,w:figureWidth,h:body.h}};
   return layout;
  }
 }
}

// The same measured rectangles travel with the page into the projector and the PPT file.
export function questionPages(stem:string,options:string[],layout:SlideLayout,subject:'english'|'chinese'|'chemistry'='english',figure?:QuestionFigure):QuestionPage[] {
 const math=subject==='chemistry';
 if(!layout.classroom){
  const original=subject==='english' ? [{label:'',text:stem},{label:'选项',text:options.join('\n')}]
   : [{label:'题面',text:[stem,...options].join('\n'),math}];
  return paginateBlocks(original,layout,subject==='chinese'?'chinese':'question').map(page=>({blocks:page}));
 }
 const blocks=[stem,...options].filter(text=>text.trim()).map(text=>({label:'',text,math}));
 if(!blocks.length)return [];
 const fitted=(figure && fitQuestion(blocks,layout.body,figure)) || fitQuestion(blocks,layout.body);
 if(fitted)return [{blocks,questionLayout:fitted}];
 // Keep complete choices together on continuation pages. Split text only if a block exceeds a whole page.
 const pages:QuestionPage[]=[];
 let pending:SlideBlock[]=[];
 let fittedGroup:QuestionLayout|undefined;
 for(const block of blocks){
  const candidate=[...pending,block];
  const measured=fitQuestion(candidate,layout.body,undefined,candidate[0]===blocks[0]);
  if(measured){pending=candidate;fittedGroup=measured;continue;}
  if(pending.length)pages.push({blocks:pending,questionLayout:fittedGroup});
  pending=[block];fittedGroup=fitQuestion(pending,layout.body,undefined,block===blocks[0]);
  if(fittedGroup)continue;
  for(const chunk of splitQuestionBlock(block,layout,block===blocks[0]?22:21)){
   pages.push({blocks:chunk,questionLayout:fitQuestion(chunk,layout.body,undefined,block===blocks[0])});
  }
  pending=[];
 }
 if(pending.length)pages.push({blocks:pending,questionLayout:fittedGroup});
 return pages;
}
