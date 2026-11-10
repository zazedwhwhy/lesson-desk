import {resolveEvidence} from '../core/evidence';
import {z} from 'zod';
import {callAI} from './ai';
import type {Project,Settings} from '../core/model';
import {chineseSchema,chineseReviewSchema,chineseGroupSchema,chineseResultSchema,chineseChecks,chineseFingerprint,validateChineseResult,applicableChineseModules,chineseModuleNames,type ChineseModule} from '../core/chinese';
import {ServiceStopError} from '../core/generation-model';
import {chineseSystem,chineseOrganizeInstruction,chineseInstructions as instructions} from '../core/chinese-prompts';
export async function organizeChinese(p:Project,s:Settings,key:string,signal:AbortSignal){
 const schema=z.object({groups:z.array(chineseGroupSchema.omit({versions:true}))});
 const out=await callAI(s,key,schema,chineseOrganizeInstruction+'\n输入：'+JSON.stringify(p.sources.map(x=>({id:x.id,role:x.role,name:x.name,blocks:x.blocks}))),signal,()=>{},chineseSystem,[],32768);
 const data=chineseSchema.parse({groups:out.groups});
 if(!data.groups.length||!data.groups.some(g=>g.questions.length))throw Error('未整理出题目，原课件已保留');
 for(const g of data.groups)for(const m of g.materials){const src=p.sources.find(s=>s.id===m.sourceId);if(!src||!m.blockIds.length)throw Error('材料未关联原文件，未保存整理结果');const blocks=m.blockIds.map(id=>{const b=src.blocks.find(b=>b.id===id);if(!b)throw Error('材料引用了不存在的原文块');return b;});const bound=blocks.map(b=>b.text).join('\n');m.text=resolveEvidence([{id:'source',text:bound}],{blockId:'source',quote:m.text}).quote;}
 const errors=chineseChecks(data).filter(x=>/重复|不存在/.test(x));if(errors.length)throw Error(errors.join('；'));
 if(p.chinese?.groups.length)data.history=[...p.chinese.history,{at:new Date().toISOString(),groups:p.chinese.groups}];
 return {...p,chinese:data};
}
export async function generateChinese(p:Project,groupIds:string[],modules:ChineseModule[],s:Settings,key:string,signal:AbortSignal,checkpoint:(p:Project,message:string)=>Promise<void>,resume=false,questionIds?:string[]){
 const d=p.chinese;if(p.subject!=='chinese'||!d)throw Error('不是语文课件');
 const structural=chineseChecks(d).filter(x=>/重复|不存在|为空/.test(x));if(structural.length)throw Error(structural.join('；'));
 if(!resume){if(!modules.length||modules.some(m=>!(m in instructions)))throw Error('请选择有效教学模块');const groups=d.groups.filter(g=>groupIds.includes(g.id));if(!groups.length)throw Error('请选择材料组');d.tasks=[];for(const g of groups){const qs=g.questions.filter(q=>!q.excluded&&(!questionIds||questionIds.includes(q.id)));if(qs.some(q=>!q.confirmed))throw Error(g.title+'：请先核对题面');for(const module of modules.filter(m=>applicableChineseModules(g).includes(m))){const targets=['analysis','practice'].includes(module)?qs:[undefined];for(const q of targets)d.tasks.push({id:crypto.randomUUID(),groupId:g.id,questionId:q?.id,questionIds:qs.map(q=>q.id),module,fingerprint:chineseFingerprint(d,g,q?.id),state:'pending',error:'',attempts:0});}}}
 if(!d.tasks.length)throw Error('没有适用任务');
 for(const t of d.tasks){const g=d.groups.find(g=>g.id===t.groupId);if(!g||t.fingerprint!==chineseFingerprint(d,g,t.questionId))throw Error('材料或题目已变化，请重新选择生成');if(t.state!=='complete'){if((t.questionIds||g.questions.filter(q=>!q.excluded).map(q=>q.id)).some(id=>!g.questions.some(q=>q.id===id&&q.confirmed&&!q.excluded)))throw Error('题目核对或排除状态已变化，请重新选择生成范围');t.state='pending';}}
 for(const t of d.tasks){if(t.state==='complete'||signal.aborted)continue;const g=d.groups.find(g=>g.id===t.groupId)!;t.state='running';t.attempts++;t.error='';await checkpoint(p,'正在生成：'+g.title+' · '+chineseModuleNames[t.module]);
 try{const qs=g.questions.filter(q=>!q.excluded&&(!t.questionId||q.id===t.questionId)&&(!t.questionIds||t.questionIds.includes(q.id)));const ids=new Set(qs.flatMap(q=>q.materialIds));const materials=d.groups.flatMap(g=>g.materials).filter(m=>g.materials.some(x=>x.id===m.id)||ids.has(m.id));let input:unknown={kind:g.kind,title:g.title,materials:materials.map(({image,...m})=>({...m,hasImage:!!image})),questions:qs};let images=materials.flatMap(m=>m.image?[m.image]:[]);
 if(t.module==='practice'){
  const blueprint=await callAI(s,key,z.object({skill:z.string().min(1),format:z.string().min(1),constraints:z.array(z.string())}),'仅提炼目标语文题的考查能力、作答形式及必要约束。不输出原卷人名、故事、事实、答案或原题选项。\n输入：'+JSON.stringify({kind:g.kind,questions:qs}),signal,()=>{},chineseSystem);
  input=blueprint;images=[];
 }
 const raw=await callAI(s,key,chineseResultSchema,instructions[t.module]+'\n每块给label、text、evidence；引用只用materialId和该材料连续逐字quote，AI新编练习evidence为空数组。\n输入：'+JSON.stringify(input),signal,()=>{},chineseSystem,images);
 if(t.module==='practice'){
  const review=await callAI(s,key,z.object({valid:z.boolean(),reason:z.string()}),'独立复核这道AI新编语文练习：材料与题面是否齐全、约束清楚、答案是否由新材料支持，是否存在未说明的多解或错误。只检查新题，不补造缺失条件；问题必须判valid=false。\n输入：'+JSON.stringify(raw),signal,()=>{},chineseSystem);
  if(!review.valid)throw Error('新编演练复核未通过：'+review.reason);
 }
 if(signal.aborted)break;const result=validateChineseResult(d,g,raw);if(t.module==='analysis'&&qs.some(q=>!q.answer.trim())&&result.status==='ok'){result.status='needs_review';result.notices.push('缺少参考答案，AI建议须经教师核实');}g.versions.push({id:crypto.randomUUID(),module:t.module,questionId:t.questionId,createdAt:new Date().toISOString(),fingerprint:t.fingerprint,confirmed:false,result});t.state='complete';}
 catch(error){t.state=signal.aborted?'pending':'failed';t.error=error instanceof Error?error.message:String(error);if(error instanceof ServiceStopError){await checkpoint(p,t.error);break;}}
 await checkpoint(p,t.state==='failed'?'此项失败：'+t.error:'已保存：'+g.title+' · '+chineseModuleNames[t.module]);}
 for(const t of d.tasks)if(t.state==='running')t.state='pending';await checkpoint(p,`语文生成结束：${d.tasks.filter(t=>t.state==='complete').length} 项已保存，${d.tasks.filter(t=>t.state!=='complete').length} 项未完成。请核实后编排课件。`);return p;
}

export async function reviewChinese(p:Project,s:Settings,key:string,signal:AbortSignal){
 if(p.subject!=='chinese'||!p.chinese)throw Error('请选择语文课件');const d=p.chinese;if(!d.groups.length)throw Error('请先整理材料组');
 const snapshot=JSON.stringify([p.sources,d.groups.map(({versions,...g})=>g)]);
 const result=await callAI(s,key,chineseReviewSchema,'逐题对照原卷与答案来源校对语文试卷整理结果，核查题干选项错位、漏题、OCR疑字、材料遗漏、图片信息未核、答案来源和子问关联。只报告问题，不修改输入。checkedQuestionIds只能使用实际检查过的题目id；未检查全卷或无法核对图片时coverage=partial并说明limitations，不假称通过。findings的groupId与questionId使用输入值，组级问题questionId为空。不凭记忆补官方答案。\n输入：'+snapshot,signal,()=>{},chineseSystem);
 const ids=d.groups.flatMap(g=>g.questions.map(q=>q.id));if(result.checkedQuestionIds.some(id=>!ids.includes(id))||new Set(result.checkedQuestionIds).size!==result.checkedQuestionIds.length)throw Error('校对覆盖题目编号无效，报告未保存');
 if(result.coverage==='complete'&&ids.some(id=>!result.checkedQuestionIds.includes(id)))throw Error('校对遗漏题目，不能标记全卷完成');for(const f of result.findings){const g=d.groups.find(g=>g.id===f.groupId);if(!g||f.questionId&&!g.questions.some(q=>q.id===f.questionId))throw Error('校对问题关联无效，报告未保存');}
 if(!p.sources.length||d.groups.some(g=>g.materials.some(m=>m.image))){result.coverage='partial';result.limitations.push('原页图像未在本次文字校对中核验，仍需教师对照原件。');}d.review={snapshot,result};return p;
}
