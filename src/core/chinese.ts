import {paginateBlocks,defaultSlideLayout,type SlideLayout,type SlideBlock} from './slide-layout';
import {z} from 'zod';
export const chineseKinds=['information','literature','classical','poetry','recitation','language','writing'] as const;
export const chineseKindNames:Record<string,string>={information:'信息类阅读',literature:'文学类阅读',classical:'文言文',poetry:'古代诗歌',recitation:'名句默写',language:'语言文字运用',writing:'写作'};
export const chineseModules=['analysis','structure','language','translation','writing','practice'] as const;
export type ChineseModule=typeof chineseModules[number];
export const chineseModuleNames:Record<ChineseModule,string>={analysis:'逐题讲评',structure:'文本脉络',language:'语言品读',translation:'文言译注',writing:'写作指导',practice:'考点演练'};
const ref=z.object({materialId:z.string(),quote:z.string().min(1)});
export const chineseResultSchema=z.object({status:z.enum(['ok','needs_review','insufficient_material']),notices:z.array(z.string()),blocks:z.array(z.object({label:z.string().min(1),text:z.string().min(1),evidence:z.array(ref)})).min(1)});
const material=z.object({id:z.string().min(1),title:z.string(),text:z.string(),sourceId:z.string(),blockIds:z.array(z.string()),image:z.string().regex(/^data:image\/(png|jpeg);base64,/).optional(),imageConfirmed:z.boolean().default(false)});
const question=z.object({id:z.string().min(1),number:z.string(),stem:z.string(),format:z.enum(['choice','short','translation','segmentation','recitation','revision','expression','essay']),materialIds:z.array(z.string()),options:z.array(z.string()).default([]),answer:z.string().default(''),answerSource:z.enum(['provided','teacher','none']).default('none'),score:z.number().nonnegative().optional(),confirmed:z.boolean().default(false),excluded:z.boolean().default(false)});
const version=z.object({id:z.string(),module:z.enum(chineseModules),questionId:z.string().optional(),createdAt:z.string(),fingerprint:z.string(),confirmed:z.boolean().default(false),result:chineseResultSchema});
export const chineseGroupSchema=z.object({id:z.string().min(1),section:z.string(),title:z.string(),kind:z.enum(chineseKinds),materials:z.array(material),questions:z.array(question),versions:z.array(version).default([])});
export const chineseReviewSchema=z.object({coverage:z.enum(['complete','partial']),checkedQuestionIds:z.array(z.string()),limitations:z.array(z.string()),findings:z.array(z.object({groupId:z.string(),questionId:z.string(),message:z.string().min(1)}))});
export const chineseSchema=z.object({review:z.object({snapshot:z.string(),result:chineseReviewSchema}).optional(),version:z.literal(1).default(1),groups:z.array(chineseGroupSchema).default([]),history:z.array(z.object({at:z.string(),groups:z.array(chineseGroupSchema)})).default([]),tasks:z.array(z.object({id:z.string(),groupId:z.string(),questionId:z.string().optional(),questionIds:z.array(z.string()).optional(),module:z.enum(chineseModules),fingerprint:z.string(),state:z.enum(['pending','running','complete','failed']),error:z.string(),attempts:z.number().default(0)})).default([])});
export type ChineseData=z.infer<typeof chineseSchema>;
export type ChineseGroup=z.infer<typeof chineseGroupSchema>;
export type ChineseResult=z.infer<typeof chineseResultSchema>;
export function applicableChineseModules(g:ChineseGroup):ChineseModule[]{return ['analysis','structure','language',...(['classical','poetry'].includes(g.kind)?['translation' as const]:[]),...(['writing','literature'].includes(g.kind)||g.questions.some(q=>['essay','expression'].includes(q.format))?['writing' as const]:[]),'practice'];}
export function chineseFingerprint(d:ChineseData,g:ChineseGroup,qid?:string){const qs=qid?g.questions.filter(q=>q.id===qid):g.questions;const ids=new Set(qs.flatMap(q=>q.materialIds));return JSON.stringify([g.kind,g.title,d.groups.flatMap(a=>a.materials).filter(m=>g.materials.some(x=>x.id===m.id)||ids.has(m.id)),qs.map(({confirmed,...q})=>q)]);}
export function chineseChecks(d:ChineseData){const out:string[]=[],mids=d.groups.flatMap(g=>g.materials.map(m=>m.id)),qids=new Set<string>(),nums=new Set<string>(),gids=new Set<string>();if(!d.groups.length)out.push('尚未整理材料组');for(const g of d.groups){if(gids.has(g.id))out.push('材料组编号重复：'+g.title);gids.add(g.id);for(const m of g.materials){if(!m.text.trim()&&!m.image)out.push(g.title+'：材料为空');if(m.image&&!m.imageConfirmed)out.push(g.title+'：图片尚未核对');if(mids.filter(id=>id===m.id).length>1)out.push(g.title+'：材料编号重复');}for(const q of g.questions){if(q.excluded)continue;if(qids.has(q.id))out.push('题目编号重复：'+q.number);qids.add(q.id);if(nums.has(q.number))out.push('题号重复：'+q.number);nums.add(q.number);if(!q.stem.trim())out.push('第'+q.number+'题：题干为空');if(q.materialIds.some(id=>!mids.includes(id)))out.push('第'+q.number+'题：关联材料不存在');if(!q.confirmed)out.push('第'+q.number+'题：题面尚未核对');}}return [...new Set(out)];}
export function validateChineseResult(d:ChineseData,g:ChineseGroup,raw:unknown){const r=chineseResultSchema.parse(raw);const allowed=new Set([...g.materials.map(m=>m.id),...g.questions.flatMap(q=>q.materialIds)]);for(const b of r.blocks)for(const e of b.evidence){const m=d.groups.flatMap(x=>x.materials).find(m=>m.id===e.materialId);if(!m||!allowed.has(m.id)||!m.text.includes(e.quote))throw Error('讲义引用与关联材料不一致，未保存本次输出');}if(r.status==='ok'&&g.materials.some(m=>m.image&&!m.imageConfirmed))throw Error('图片尚未核对，不能标记讲义完成');return r;}
export function chineseAvailable(d:ChineseData,g:ChineseGroup,v:ChineseGroup['versions'][number]){return v.confirmed&&v.result.status==='ok'&&v.fingerprint===chineseFingerprint(d,g,v.questionId)&&!g.materials.some(m=>m.image&&!m.imageConfirmed)&&(!v.questionId||g.questions.some(q=>q.id===v.questionId&&q.confirmed&&!q.excluded));}
export type ChineseSlide={id:string;kind:string;title:string;section:string;body:string[];blocks:{label:string;text:string;emphasis?:boolean}[];passageId:string;image?:string;sourceVersionId?:string;questionId?:string};
export function chineseSlides(d:ChineseData,selected:string[],layout:SlideLayout=defaultSlideLayout):ChineseSlide[]{
 const slides:ChineseSlide[]=[];const known=new Set(d.groups.flatMap(g=>['source:'+g.id,...g.versions.map(v=>v.id)]));if(selected.some(id=>!known.has(id)))throw Error('所选内容已不存在，请重新编排');
 const add=(g:ChineseGroup,title:string,label:string,text:string,image?:string,content?:SlideBlock[],sourceVersionId?:string,questionId?:string)=>{
  if(image)slides.push({id:'zh-'+slides.length,kind:'chinese',title:title+' · 原页',section:g.section+' · '+g.title,body:[],blocks:[],passageId:g.id,image});
  const parts=paginateBlocks(content||[{label,text}],layout,'chinese');parts.forEach((blocks,i)=>slides.push({id:'zh-'+slides.length,kind:'chinese',title:title+(parts.length>1?`（${i+1}/${parts.length}）`:''),section:g.section+' · '+g.title,body:blocks.map(b=>b.text),blocks,passageId:g.id,sourceVersionId,questionId}));
 };
 for(const g of d.groups){
  if(selected.includes('source:'+g.id))for(const m of g.materials){if(m.image&&!m.imageConfirmed)throw Error('图片尚未核对');add(g,m.title,'原文',m.text,m.image);}
  const emit=(v:ChineseGroup['versions'][number])=>{
   if(!chineseAvailable(d,g,v))throw Error('所选讲义未确认、待核实或已过期');
   const title=(v.questionId?'第 '+g.questions.find(q=>q.id===v.questionId)?.number+' 题 · ':'')+chineseModuleNames[v.module];
   const content=v.result.blocks;
   const answerAt=content.findIndex(b=>/答案|参考作答|参考解答|解答|解析|讲评|迁移说明|考点.*迁移/.test(b.label));
   // Practice keeps the student's task separate from its solution. Older labels
   // without a recognizable boundary retain their original block boundaries.
   const groups=v.module!=='practice'?[content]:answerAt>0?[content.slice(0,answerAt),content.slice(answerAt)]:content.map(b=>[b]);
   groups.forEach((group,i)=>add(g,title+(v.module==='practice'&&answerAt>0&&i?' · 演练讲评':''),'','',undefined,group.flatMap(b=>[{label:b.label,text:b.text},...b.evidence.map(e=>({label:'原文依据',text:e.quote}))]),v.id));
  };
  for(const q of g.questions.filter(q=>!q.excluded)){const vs=g.versions.filter(v=>v.questionId===q.id&&selected.includes(v.id));if(vs.length){add(g,'第 '+q.number+' 题','题面',[q.stem,...q.options].join('\n'),undefined,undefined,undefined,q.id);vs.forEach(emit);}}
  g.versions.filter(v=>!v.questionId&&selected.includes(v.id)).forEach(emit);
  if(g.versions.some(v=>v.questionId&&selected.includes(v.id)&&!g.questions.some(q=>q.id===v.questionId&&!q.excluded)))throw Error('所选题目已排除或不存在');
 }if(!slides.length)throw Error('请至少选择一项有效内容');return slides;
}
