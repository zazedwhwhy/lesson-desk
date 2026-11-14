import {z} from 'zod';
import {paginateBlocks,defaultSlideLayout,type SlideBlock} from './slide-layout';
const date=z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v),'日期格式应为 YYYY-MM-DD');
export const reviewSchema=z.object({id:z.string().uuid(),date:date.refine(Boolean),result:z.enum(['wrong','partial','correct','absent']),answer:z.string(),comment:z.string(),score:z.number().nonnegative().optional(),total:z.number().positive().optional(),exerciseId:z.string().optional()}).refine(v=>v.score===undefined||v.total===undefined||v.score<=v.total,'得分不能超过满分');
export const recordSchema=z.object({id:z.string().uuid(),className:z.string().trim().min(1,'请填写班级'),student:z.string().trim(),cause:z.string(),wrongAnswer:z.string(),note:z.string(),taught:z.boolean(),mastered:z.boolean(),due:date,wrong:z.number().int().nonnegative().optional(),participants:z.number().int().positive().optional(),reviews:z.array(reviewSchema)}).refine(v=>v.wrong===undefined||v.participants===undefined||v.wrong<=v.participants,'错误人数不能超过参与人数');
export const sourceRefSchema=z.object({questionId:z.string().optional(),passageId:z.string().optional(),groupId:z.string().optional(),versionId:z.string().optional(),module:z.string().optional()});
export type NotebookSourceRef=z.infer<typeof sourceRefSchema>;
export const entrySchema=z.object({id:z.string().uuid(),createdAt:z.string(),projectId:z.string(),projectTitle:z.string(),subject:z.enum(['english','chinese','chemistry']),kind:z.enum(['question','excerpt']),title:z.string().min(1),text:z.string().min(1),context:z.string(),sourceId:z.string().optional(),sourceRef:sourceRefSchema.optional(),revision:z.number().int().nonnegative().default(0),tags:z.array(z.string()).default([]),topics:z.array(z.string()).default([]),records:z.array(recordSchema).default([]),archived:z.boolean().default(false),reviewed:z.boolean().default(false),studentText:z.string().default(''),material:z.string().default(''),answer:z.string().default(''),studentReady:z.boolean().default(false),images:z.array(z.string().regex(/^data:image\/(png|jpeg);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)).default([]),relatedIds:z.array(z.string().uuid()).default([])});
export type NotebookEntry=z.infer<typeof entrySchema>;
export type NotebookRecord=z.infer<typeof recordSchema>;
export const outputSchema=z.object({ids:z.array(z.string().uuid()).min(1),audience:z.enum(['student','teacher']),modules:z.array(z.enum(['material','question','answer','mistakes'])).min(1),format:z.enum(['pptx','pdf']).default('pptx')});
export type NotebookOutput=z.infer<typeof outputSchema>;
export type NotebookSlide={title:string;section:string;kind:string;blocks:SlideBlock[];image?:string};
export function notebookDeck(all:NotebookEntry[],raw:unknown):NotebookSlide[]{const o=outputSchema.parse(raw);const slides:NotebookSlide[]=[];for(const id of o.ids){const e=all.find(e=>e.id===id&&!e.archived);if(!e)throw Error('所选条目不存在或已归档');if(!e.reviewed)throw Error('请先核对条目：'+e.title);if(o.audience==='student'&&(!e.studentReady||!e.studentText.trim()))throw Error('请先确认学生版题面：'+e.title);
 const add=(kind:string,label:string,text:string)=>{if(!text.trim())return;for(const blocks of paginateBlocks([{label,text,math:e.subject==='chemistry'}],defaultSlideLayout,kind))slides.push({title:e.title,section:e.projectTitle,kind,blocks});};
 if(o.modules.includes('material')){add('source','材料',e.material);for(const image of e.images)slides.push({title:e.title,section:e.projectTitle,kind:'source',blocks:[],image});}
 if(o.modules.includes('question'))add('question',o.audience==='student'?'题目（请独立作答）':'题目',o.audience==='student'?e.studentText:e.studentText||e.text);
 if(o.audience==='teacher'&&o.modules.includes('answer'))add('analysis','答案与讲解',e.answer||e.context);
 if(o.audience==='teacher'&&o.modules.includes('mistakes'))add('analysis','匿名典型错答与错因',e.records.map(r=>[r.wrongAnswer,r.cause].filter(Boolean).join('\n')).filter(Boolean).join('\n\n'));
 }if(!slides.length)throw Error('所选范围没有可输出的内容');return slides;}
export function localDay(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
export function nextReview(days:number){const d=new Date();d.setDate(d.getDate()+days);return localDay(d);}
