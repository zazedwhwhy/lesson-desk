import {z} from 'zod';
import {paginateBlocks,defaultSlideLayout,type SlideLayout,type SlideBlock} from './slide-layout';

export const chemModules=['analysis','knowledge','method','experiment','practice'] as const;
export type ChemModule=typeof chemModules[number];
export const chemNames:Record<ChemModule,string>={analysis:'逐题讲评',knowledge:'知识梳理',method:'题型方法',experiment:'实验剖析',practice:'考点演练'};
export const chemKinds=['choice','principle','calculation','experiment','process','organic'] as const;
export const chemKindNames:Record<typeof chemKinds[number],string>={choice:'选择与判断',principle:'化学原理',calculation:'定量计算',experiment:'实验探究',process:'工艺流程',organic:'有机推断'};
const text=z.string().trim().min(1);
export const chemImageSchema=z.object({id:text,name:text,data:z.string().max(16*1024*1024).regex(/^data:image\/(png|jpeg);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),sourceId:z.string().optional(),page:z.number().int().positive().optional(),description:z.string().default(''),confirmed:z.boolean().default(false)});
export const chemResultSchema=z.object({status:z.enum(['ok','needs_review','insufficient_material']),notices:z.array(text),blocks:z.array(z.object({label:text,text})).min(1)});
export function validChemPractice(result:z.infer<typeof chemResultSchema>){return JSON.stringify(result.blocks.map(b=>b.label))===JSON.stringify(['题目','答案','解析与迁移']);}
export const chemVersionSchema=z.object({id:text,module:z.enum(chemModules),createdAt:text,origin:z.enum(['ai','teacher']),fingerprint:text,confirmed:z.boolean(),result:chemResultSchema}).superRefine((v,ctx)=>{if(v.module==='practice'&&v.result.status==='ok'&&!validChemPractice(v.result))ctx.addIssue({code:'custom',message:'演练必须分别包含题目、答案、解析与迁移三个内容块；请重新生成结构不完整的演练'});});
export const chemQuestionSchema=z.object({id:text,number:text,stage:z.enum(['junior','senior']).default('senior'),kind:z.enum(chemKinds).default('principle'),stem:z.string().default(''),options:z.array(z.string()).default([]),answer:z.string().default(''),sourceId:z.string().default(''),pages:z.array(z.number().int().positive()).default([]),images:z.array(chemImageSchema).max(12).default([]),imageMode:z.enum(['description','vision']).default('description'),confirmed:z.boolean().default(false),excluded:z.boolean().default(false),versions:z.array(chemVersionSchema).default([])});
const task=z.object({id:text,questionId:text,module:z.enum(chemModules),fingerprint:text,state:z.enum(['pending','running','complete','failed']),error:z.string(),attempts:z.number().int().nonnegative()});
export const chemistrySchema=z.object({version:z.literal(1).default(1),questions:z.array(chemQuestionSchema).default([]),history:z.array(z.object({at:text,questions:z.array(chemQuestionSchema)})).default([]),tasks:z.array(task).default([])}).superRefine((d,ctx)=>{
 const ids=new Set<string>(),numbers=new Set<string>();
 for(const q of d.questions){
  for(const id of [q.id,...q.versions.map(v=>v.id)]){if(ids.has(id))ctx.addIssue({code:'custom',message:'化学题目或讲义 ID 重复'});ids.add(id);}
  if(!q.excluded){if(numbers.has(q.number))ctx.addIssue({code:'custom',message:'化学题号重复：'+q.number});numbers.add(q.number);}
  if(new Set(q.images.map(i=>i.id)).size!==q.images.length)ctx.addIssue({code:'custom',message:'题图 ID 重复'});
 }
});
export type Chemistry=z.infer<typeof chemistrySchema>;
export type ChemQuestion=z.infer<typeof chemQuestionSchema>;
export type ChemVersion=z.infer<typeof chemVersionSchema>;
export type ChemResult=z.infer<typeof chemResultSchema>;
// Content identity only (not a security signature). Keep megabytes of base64 out
// of every task/version fingerprint; the original image remains in the question.
function imageIdentity(data:string){
 let a=0xdeadbeef,b=0x41c6ce57;
 for(let i=0;i<data.length;i++){const code=data.charCodeAt(i);a=Math.imul(a^code,2654435761);b=Math.imul(b^code,1597334677);}
 a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);
 b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);
 return data.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);
}
export function chemFingerprint(q:ChemQuestion){return JSON.stringify([q.number,q.stage,q.kind,q.stem,q.options,q.answer,q.sourceId,q.pages,q.imageMode,q.images.map(({confirmed,data,...image})=>({...image,imageIdentity:imageIdentity(data)}))]);}
export function chemChecks(q:ChemQuestion){
 const issues:string[]=[];
 if(q.excluded)issues.push('题目已排除');
 if(!q.stem.trim())issues.push('题干为空');
 if(!q.confirmed)issues.push('题面尚未核对');
 if(q.images.some(i=>!i.confirmed))issues.push('图片尚未核对');
 if(q.imageMode==='description'&&q.images.some(i=>!i.description.trim()))issues.push('文字模式需要填写每张图片的图示说明');
 return issues;
}
export function chemReady(q:ChemQuestion,v:ChemVersion){return !chemChecks(q).length&&v.confirmed&&v.result.status==='ok'&&(v.module!=='practice'||validChemPractice(v.result))&&v.fingerprint===chemFingerprint(q);}
export function reviseChemistry(old:Chemistry|undefined,next:Chemistry){
 for(const q of next.questions){const prev=old?.questions.find(a=>a.id===q.id);if(prev&&chemFingerprint(prev)!==chemFingerprint(q)){q.confirmed=false;for(const image of q.images){const prior=prev.images.find(i=>i.id===image.id);if(!prior||JSON.stringify([prior.data,prior.description,prior.sourceId,prior.page])!==JSON.stringify([image.data,image.description,image.sourceId,image.page]))image.confirmed=false;}}}
 return next;
}
export type ChemSlide={id:string;kind:string;title:string;section:string;blocks:SlideBlock[];questionId:string;image?:string;sourceVersionId?:string};
export function chemSlides(d:Chemistry,selected:string[],layout:SlideLayout=defaultSlideLayout):ChemSlide[]{
 const known=new Set(d.questions.flatMap(q=>['question:'+q.id,...q.versions.map(v=>v.id)]));
 if(selected.some(id=>!known.has(id)))throw Error('所选内容已不存在，请重新编排');
 const slides:ChemSlide[]=[];
 for(const q of d.questions){
  const versions=q.versions.filter(v=>selected.includes(v.id)).sort((a,b)=>chemModules.indexOf(a.module)-chemModules.indexOf(b.module));
  if(!versions.length&&!selected.includes('question:'+q.id))continue;
  const checks=chemChecks(q);if(checks.length)throw Error('第 '+q.number+' 题：'+checks.join('；'));
  const add=(title:string,blocks:SlideBlock[],kind='analysis',version?:string)=>paginateBlocks(blocks,layout,kind).forEach((blocks,i)=>slides.push({id:'chem-'+slides.length,kind,title:title+(i?'（续）':''),section:'化学 · '+chemKindNames[q.kind],questionId:q.id,sourceVersionId:version,blocks}));
  // A selected explanation always carries the original question and figures.
  add('第 '+q.number+' 题',[{label:'题面',text:[q.stem,...q.options].join('\n')}],'question');
  for(const image of q.images)slides.push({id:'chem-'+slides.length,kind:'source',title:'第 '+q.number+' 题 · '+image.name,section:image.page?'原材料第 '+image.page+' 页':'题目配图',questionId:q.id,blocks:[],image:image.data});
  for(const v of versions){
   if(!chemReady(q,v))throw Error('所选讲义未确认、待核实或已过期：第 '+q.number+' 题 · '+chemNames[v.module]);
   // Practice blocks are separate slides so solutions cannot appear with tasks.
   const groups=v.module==='practice'?v.result.blocks.map(b=>[b]):[v.result.blocks];
   groups.forEach(blocks=>add('第 '+q.number+' 题 · '+chemNames[v.module],blocks,v.module==='practice'?'practice':'analysis',v.id));
  }
 }
 if(!slides.length)throw Error('请至少选择一项有效内容');
 return slides;
}
