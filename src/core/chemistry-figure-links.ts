import type {Project,Source} from './model';
import {chemFingerprint,type ChemQuestion} from './chemistry';
import {organizationNumber} from './organization-coverage';
import {GenerationContentError} from './errors';

export function questionFigures(source:Source,number:string,figureIds?:string[]):ChemQuestion['images']{
 const figures=source.figures||[];
 for(const id of figureIds||[])if(!figures.some(f=>f.id===id))throw new GenerationContentError('第 '+number+' 题引用了不存在或其他来源的题图：'+id);
 return figures.filter(f=>figureIds?figureIds.includes(f.id):f.questionNumbers.some(n=>organizationNumber(n)===organizationNumber(number))).map(f=>({id:f.id,name:f.name,data:f.data,sourceId:source.id,page:f.page,description:f.description,confirmed:false,automatic:true}));
}

/** Recovery may discover figures for an existing question; keep teacher text and versions. */
export function completeFigureLinks(p:Project){
 for(const q of p.chemistry!.questions){
  const source=p.sources.find(s=>s.id===q.sourceId);if(!source)continue;
  const images=questionFigures(source,q.number).filter(im=>!q.dismissedFigureIds?.includes(im.id)&&!q.images.some(old=>old.id===im.id));
  if(images.length){
   if(q.images.length+images.length>12)throw new GenerationContentError('第 '+q.number+' 题超过12张配图，请拆分题目后继续');
   const before=chemFingerprint(q);q.images.push(...images);q.imageMode='auto';
   if(chemFingerprint(q)!==before)q.confirmed=false;
  }
 }
 for(const source of p.sources.filter(s=>s.role==='paper'))for(const f of source.figures||[]){
  if(!p.chemistry!.questions.some(q=>q.sourceId===source.id&&q.images.some(i=>i.id===f.id)))
   (p.organizationIssues??=[]).push(source.name+' · '+f.name+'：已保留原图，暂未找到对应题目，请在题图待关联区核对。');
 }
 return p;
}
