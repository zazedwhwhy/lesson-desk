import {mathjax} from 'mathjax-full/js/mathjax.js';
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js';

// A synchronous, offline renderer shared by screen and PPT. No autoload, URLs or HTML macros.
const adaptor=liteAdaptor();RegisterHTMLHandler(adaptor);
export type Formula={svg:string;width:number;height:number};
const cache=new Map<string,Formula>();
export function renderFormula(tex:string,display=false):Formula{
 const key=String(display)+tex,prior=cache.get(key);if(prior)return prior;
 if(tex.length>10000)throw Error('公式过长，请拆分后重试');
 // A new TeX context prevents definitions in one formula from changing another.
 const document=mathjax.document('',{InputJax:new TeX({packages:['base','ams','newcommand','mhchem'],maxBuffer:10000,maxMacros:1000}),OutputJax:new SVG({fontCache:'none'})});
 const node=document.convert(tex,{display,em:16,ex:8,containerWidth:1200});
 const svg=adaptor.tags(node,'svg')[0];
 if(!svg||adaptor.tags(svg,'g').some(g=>adaptor.getAttribute(g,'data-mml-node')==='merror'))throw Error('公式语法无效，请检查 LaTeX：'+tex.slice(0,80));
 const box=String(adaptor.getAttribute(svg,'viewBox')).split(/\s+/).map(Number);
 if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)throw Error('公式尺寸无效，请检查 LaTeX');
 const result={svg:adaptor.outerHTML(svg),width:box[2]/1000,height:box[3]/1000};
 if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
}
export type MathPart={raw:string;text:string;math:boolean;display:boolean;error?:string};
export function splitMath(text:string):MathPart[]{
 const parts:MathPart[]=[];let start=0,i=0;
 const escaped=(at:number)=>{let n=0;for(let j=at-1;j>=0&&text[j]==='\\';j--)n++;return n%2===1;};
 while(i<text.length){
  const open=['$$','\\[','\\(','$'].find(d=>text.startsWith(d,i)&&!escaped(i));
  if(!open){i++;continue;}
  const close=open==='\\['?'\\]':open==='\\('?'\\)':open;let end=i+open.length;
  while((end=text.indexOf(close,end))>=0&&escaped(end))end+=close.length;
  // Dollar amounts such as "$5 ... $10" remain literal, even in chemistry prose.
  if(open==='$'&&/\d/.test(text[i+1]||'')&&(end<0||/\d/.test(text[end+1]||''))){i++;continue;}
  if(end<0){if(i>start)parts.push({raw:text.slice(start,i),text:text.slice(start,i),math:false,display:false});parts.push({raw:text.slice(i),text:text.slice(i+open.length),math:true,display:open.length===2,error:'公式定界符未闭合，请补齐 '+close});start=text.length;break;}
  if(i>start)parts.push({raw:text.slice(start,i),text:text.slice(start,i),math:false,display:false});
  parts.push({raw:text.slice(i,end+close.length),text:text.slice(i+open.length,end),math:true,display:open==='$$'||open==='\\['});
  i=end+close.length;start=i;
 }
 if(start<text.length)parts.push({raw:text.slice(start),text:text.slice(start),math:false,display:false});return parts;
}
export const hasMath=(text:string)=>splitMath(text).some(p=>p.math);
export type MathRun={raw:string;text:string;x:number;w:number;h:number;formula?:Formula};
export type MathLine={raw:string;runs:MathRun[];h:number};
export function mathLines(text:string,width:number,fontSize:number):MathLine[]{
 const em=fontSize/72,base=em*1.32,lines:MathLine[]=[];let row:MathLine={raw:'',runs:[],h:base},used=0;
 const flush=()=>{if(row.raw){lines.push(row);row={raw:'',runs:[],h:base};used=0;}};
 const push=(run:MathRun)=>{if(used&&used+run.w>width*.91)flush();run.x=used;row.raw+=run.raw;const previous=row.runs.at(-1);if(previous&&!previous.formula&&!run.formula){previous.raw+=run.raw;previous.text+=run.text;previous.w+=run.w;}else row.runs.push(run);row.h=Math.max(row.h,run.h+.04);used+=run.w;};
 for(const part of splitMath(text)){
  if(part.error)throw Error(part.error);
  if(part.math){const f=renderFormula(part.text,part.display),w=f.width*em,h=f.height*em;
   if(w>width*.91)throw Error('公式超出页面宽度，请拆成多行或选择更宽的模板');
   if(part.display)flush();push({raw:part.raw,text:part.text,x:0,w,h,formula:f});if(part.display)flush();
  }else for(const token of part.text.match(/\n|[^\S\n]+|[a-zA-Z0-9’'-]+|./gu)||[]){
   if(token==='\n'){row.raw+='\n';flush();continue;}
   const w=[...token].reduce((n,c)=>n+(/[^\u0000-\u007f]/u.test(c)?1:.55)*em,0);
   if(w>width*.91){for(const c of token)push({raw:c,text:c,x:0,w:(/[^\u0000-\u007f]/u.test(c)?1:.55)*em,h:base});}
   else push({raw:token,text:token,x:0,w,h:base});
  }
 }
 flush();return lines;
}
