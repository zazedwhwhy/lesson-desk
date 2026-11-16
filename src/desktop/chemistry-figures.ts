import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas,loadImage,type Canvas} from '@napi-rs/canvas';
import {callAI} from './ai';
import {figureDetectionSchema,figurePixels,sourceFigureSchema,chemistryFigureInstruction,chemistryFigureSystem} from '../core/chemistry-figures';
import {GenerationContentError} from '../core/errors';
import {assertOcrReviewed} from '../core/source-fidelity';
import {validateBundlePath} from '../core/logic';
import {uid,type Project,type Settings,type Source} from '../core/model';

export function wordFigureInputs(html:string){
 const matches=[...html.matchAll(/<img[^>]+src="(data:image\/[^\"]+)"[^>]*>/g)];
 const text=(s:string)=>s.replace(/<img[^>]*>/g,' [图片] ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 return [...new Set(matches.map(m=>m[1]))].map(data=>({data,contexts:matches.filter(m=>m[1]===data).map(m=>({before:text(html.slice(0,m.index)).slice(-1500),after:text(html.slice(m.index!+m[0].length)).slice(0,800)}))}));
}
export function figureRenderScale(width:number,height:number){return Math.min(2,3200/Math.max(width,height));}

export async function detectChemistryFigures(canvas:Canvas,context:unknown,s:Settings,key:string,signal:AbortSignal){
 let feedback='';
 for(let attempt=0;attempt<2;attempt++){
  const result=await callAI(s,key,figureDetectionSchema,chemistryFigureInstruction+'\n输入材料：'+JSON.stringify(context)+feedback,signal,undefined,chemistryFigureSystem,[canvas.toDataURL('image/jpeg',90)],4096);
  try{return result.figures.map(f=>{
   const region=figurePixels(f.box,canvas.width,canvas.height),scale=Math.min(1,1800/Math.max(region.width,region.height));
   const crop=createCanvas(Math.ceil(region.width*scale),Math.ceil(region.height*scale));
   crop.getContext('2d').drawImage(canvas,region.x,region.y,region.width,region.height,0,0,crop.width,crop.height);
   return {...f,data:crop.toDataURL('image/png')};
  });}catch(error){if(!(error instanceof GenerationContentError)||attempt||signal.aborted)throw error;feedback='\n上次区域无效，请重新定位完整原图：'+error.message;}
 }
 throw new GenerationContentError('题图识别未完成');
}

/** Runs inside the existing organize action; completed units are cached with the source. */
export async function recognizeChemistryFigures(p:Project,directory:string,s:Settings,key:string,signal:AbortSignal,save:(p:Project,message:string)=>Promise<void>){
 assertOcrReviewed(p.sources);
 async function process(source:Source,canvas:Canvas,unit:number,page?:number,nearbyText?:unknown){
  if(signal.aborted)throw Error('已取消题图识别，完成的页面已保存');
  await save(p,`正在自动识别 ${source.name} ${page?'第 '+page+' 页':'第 '+unit+' 张图片'}的题图…`);
  const context={file:source.name,page,embeddedImage:source.kind==='docx',nearbyText,sourceText:source.blocks.filter(b=>!page||!b.page||b.page===page).map(b=>b.text).join('\n').slice(0,40000),previousPageTail:page?source.blocks.filter(b=>b.page===page-1).slice(-4).map(b=>b.text).join('\n'):undefined};
  const found=await detectChemistryFigures(canvas,context,s,key,signal);
  if(signal.aborted)throw Error('已取消题图识别，本页结果未保存');
  const figures=found.map(f=>sourceFigureSchema.parse({...f,id:uid(),unit,page}));
  source.figures=[...(source.figures||[]).filter(f=>f.unit!==unit),...figures];
  source.figureScanUnits=[...(source.figureScanUnits||[]),unit];
  await save(p,`已保存 ${source.name} ${page?'第 '+page+' 页':'第 '+unit+' 张图片'}：识别到 ${figures.length} 组题图`);
 }
 for(const source of p.sources.filter(s=>s.role==='paper')){
  if(source.kind==='pdf'){
   if(!source.asset)throw Error(source.name+' 的原PDF缺失，无法自动提取题图');
   validateBundlePath(source.asset);
   if(source.pageCount&&Array.from({length:source.pageCount},(_,i)=>i+1).every(n=>source.figureScanUnits?.includes(n)))continue;
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const doc=await getDocument({data:new Uint8Array(await fs.readFile(path.join(directory,source.asset))),useSystemFonts:true}).promise;
   try{for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
    if(source.figureScanUnits?.includes(pageNumber))continue;
    if(signal.aborted)throw Error('已取消题图识别');
    const page=await doc.getPage(pageNumber),size=page.getViewport({scale:1}),viewport=page.getViewport({scale:figureRenderScale(size.width,size.height)}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    try{await page.render({canvas:canvas as any,canvasContext:canvas.getContext('2d') as any,viewport}).promise;await process(source,canvas,pageNumber,pageNumber);}finally{page.cleanup();}
   }}finally{await doc.loadingTask.destroy();}
  }else if(source.kind==='docx'){
   const images=wordFigureInputs(source.previewHtml||'');
   for(const [index,{data,contexts}] of images.entries()){
    if(source.figureScanUnits?.includes(index+1))continue;
    if(signal.aborted)throw Error('已取消题图识别');
    const image=await loadImage(data),scale=Math.min(1,2000/Math.max(image.width,image.height)),canvas=createCanvas(Math.ceil(image.width*scale),Math.ceil(image.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);await process(source,canvas,index+1,undefined,contexts);
   }
  }
 }
 return p;
}
