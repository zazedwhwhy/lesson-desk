import { z } from 'zod';
import { uid, explanationSchema, type Project, type Question } from './model';
import { reviseProject } from './logic';
import { checkIntegrity, createProofreadRequest, uniqueSourceAnswer } from './proofread';
import { resolveEvidence } from './evidence';
import { optionEntries } from './options';
import {exerciseSchema,validateExercise,exerciseText,exerciseAnswerText}from'./exercise';

const str=z.string().max(30000),ref=z.object({sourceId:z.string(),blockId:z.string(),quote:z.string().min(1).max(6000)});
const common={reason:z.string().min(1).max(2000),evidence:z.array(ref).min(1).max(10)};
const value=z.union([str,z.array(str).max(10)]);
const explanation=z.object({answer:str,analysis:str,evidence:z.array(z.object({blockId:z.string(),quote:str})),practice:str,practiceAnswer:str,exercise:exerciseSchema.nullable()});
export const correctionPlanSchema=z.object({operations:z.array(z.discriminatedUnion('kind',[
  z.object({kind:z.literal('question'),questionId:z.string(),field:z.enum(['number','stem','options','answer','passageId']),before:value,after:value,...common}),
  z.object({kind:z.literal('passage'),passageId:z.string(),field:z.enum(['paragraph','pool']),blockId:z.string(),before:str,after:str,...common}),
  z.object({kind:z.literal('explanation'),questionId:z.string(),beforeVersion:z.string(),after:explanation,...common}),
  z.object({kind:z.literal('add_question'),passageId:z.string(),number:str,stem:str,options:z.array(str),answer:str,...common}),
  z.object({kind:z.literal('exclude_duplicate'),questionId:z.string(),...common})
])).max(80),unresolved:z.array(z.string().min(1).max(2000)).max(150)});
export type CorrectionPlan=z.infer<typeof correctionPlanSchema>;
const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
const canon=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const show=(x:unknown)=>typeof x==='string'?x:JSON.stringify(x,null,2);
export const correctionFingerprint=(p:Project)=>stable({sources:p.sources,passages:p.passages,questions:p.questions});

export function createCorrectionRequest(p:Project,include:boolean){
  const base=createProofreadRequest(p,include),qs=new Map<string,string>(),ps=new Map<string,string>(),sources=new Map<string,string>(),blocks=new Map<string,string>(),paragraphs=new Map<string,string>();
  p.questions.forEach((q,i)=>qs.set('Q'+(i+1),q.id));p.passages.forEach((a,i)=>{const alias='P'+(i+1);ps.set(alias,a.id);a.paragraphs.forEach((b,j)=>paragraphs.set(alias+':'+alias+'B'+(j+1),b.id));});
  p.sources.forEach((s,i)=>{const alias='S'+(i+1);sources.set(alias,s.id);s.blocks.forEach((b,j)=>blocks.set(alias+':'+alias+'B'+(j+1),b.id));});
  const lookup=(map:Map<string,string>,id:string)=>{const original=map.get(id);if(!original)throw Error('AI修正返回未知编号 '+id+'，未应用修改');return original;};
  const input={...base.input,questions:base.input.questions.map((q,i)=>({...q,currentVersion:include&&p.questions[i].activeVersion?'V'+(i+1):''})),
    localIssues:checkIntegrity(p).map(i=>i.message),reportedIssues:p.proofread?.result.findings.map(f=>({category:f.category,description:f.description,suggestion:f.suggestion}))||[]};
  return {input,decode(raw:unknown):CorrectionPlan{
    const plan=correctionPlanSchema.parse(raw);
    const moved=new Map(plan.operations.filter(o=>o.kind==='question'&&o.field==='passageId'&&typeof o.after==='string').map(o=>[o.kind==='question'?o.questionId:'',o.kind==='question'?String(o.after):'']));
    for(const op of plan.operations){
      op.evidence=op.evidence.map(r=>({...r,sourceId:lookup(sources,r.sourceId),blockId:lookup(blocks,r.sourceId+':'+r.blockId)}));
      if(op.kind==='question'||op.kind==='explanation'||op.kind==='exclude_duplicate'){
        const alias=op.questionId;op.questionId=lookup(qs,alias);
        if(op.kind==='question'&&op.field==='passageId'){if(typeof op.before!=='string'||typeof op.after!=='string')throw Error('材料关联值无效');op.before=lookup(ps,op.before);op.after=lookup(ps,op.after);}
        if(op.kind==='explanation'){
          const at=p.questions.findIndex(q=>q.id===op.questionId),q=p.questions[at],pid=p.passages.findIndex(a=>a.id===q.passageId),pa=moved.get(alias)||'P'+(pid+1);
          const expected=q.activeVersion?'V'+(at+1):'';if(op.beforeVersion!==expected)throw Error('AI修正的解析旧版本无效');op.beforeVersion=q.activeVersion||'';
          op.after.evidence=op.after.evidence.map(r=>({...r,blockId:lookup(paragraphs,pa+':'+r.blockId)}));
        }
      }else{const alias=op.passageId;op.passageId=lookup(ps,alias);if(op.kind==='passage'&&op.field==='paragraph')op.blockId=lookup(paragraphs,alias+':'+op.blockId);}
    }
    return plan;
  }};
}

function cited(p:Project,refs:z.infer<typeof ref>[]){
  return refs.map(r=>{const s=p.sources.find(s=>s.id===r.sourceId);if(!s)throw Error('修正来源不存在');return {...r,...resolveEvidence(s.blocks,r)};});
}
function copied(text:string,refs:z.infer<typeof ref>[]){
  if(!text.trim())throw Error('不能自动写入空内容');
  if(!canon(refs.map(r=>r.quote).join(' ')).includes(canon(text)))throw Error('修改文字不能在提供的原材料证据中连续定位');
}
function answerFromSource(p:Project,q:Question,answer:string,refs:z.infer<typeof ref>[]){
  if(p.questions.filter(x=>x.number===q.number).length!==1)throw Error('重复题号无法自动确认答案来源');
  const keys=refs.filter(r=>p.sources.find(s=>s.id===r.sourceId)?.role==='answer');
  if(!keys.length)throw Error('自动修改答案必须引用答案来源');
  const indexed=uniqueSourceAnswer(p,q.number);
  if(indexed&&keys.some(r=>r.sourceId===indexed.sourceId&&r.blockId===indexed.blockId)&&answer.trim().toUpperCase()===indexed.answer)return;
  const escaped=q.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('^\\s*'+escaped+'\\s*[.．、:：)]\\s*(.+?)\\s*$');
  if(keys.some(r=>p.sources.find(s=>s.id===r.sourceId)!.blocks.find(b=>b.id===r.blockId)!.text.split('\n').some(line=>{const m=line.match(pattern);return !!m&&canon(m[1])===canon(answer);})))return;
  throw Error('无法把新答案与明确的答案来源对应，未自动修改');
}

export function applyCorrections(p:Project,raw:unknown,settings:{provider:string;model:string},include:boolean):Project{
  const plan=correctionPlanSchema.parse(raw),next=structuredClone(p),before={passages:structuredClone(p.passages),questions:structuredClone(p.questions)};
  const changes:{target:string;before:string;after:string;reason:string}[]=[],seen=new Set<string>(),newIds=new Set<string>(),explanations:string[]=[];
  const record=(key:string,target:string,old:unknown,value:unknown,reason:string)=>{if(seen.has(key))throw Error('同一位置存在重复修正');seen.add(key);if(same(old,value))throw Error('AI返回没有实际变化的修改');changes.push({target,before:show(old),after:show(value),reason});};
  // Structural edits precede explanation replacement, so quotes are checked
  // against the resulting passage and answers, not a stale intermediate state.
  const ordered=[...plan.operations.filter(o=>o.kind!=='explanation'),...plan.operations.filter(o=>o.kind==='explanation')];
  for(const op of ordered){
    const refs=cited(p,op.evidence);
    if(op.kind==='question'){
      const original=p.questions.find(q=>q.id===op.questionId),q=next.questions.find(q=>q.id===op.questionId);if(!original||!q)throw Error('修正题目不存在');
      if(!same(original[op.field],op.before))throw Error('修正旧值与当前题目不符，请重新校对');
      if(op.field==='options'){
        if(!Array.isArray(op.after)||!op.after.length)throw Error('选项修改格式无效');for(const option of optionEntries(op.after))copied(option.text,refs);
      }else{
        if(typeof op.after!=='string'||!op.after.trim())throw Error('题目修改值无效');
        if(op.field==='answer')answerFromSource(p,original,op.after,refs);
        else if(op.field==='passageId'){if(!next.passages.some(a=>a.id===op.after&&a.type===q.type))throw Error('材料关联不存在或题型不符');}
        else if(op.field==='number'){const number=op.after;if(!refs.some(r=>new RegExp('(?:^|\\n)\\s*'+number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[.．、)]').test(r.quote)))throw Error('新题号缺少原卷依据');}
        else copied(op.after,refs);
      }
      record('q:'+q.id+':'+op.field,'第 '+q.number+' 题 · '+({number:'题号',stem:'题干',options:'选项',answer:'参考答案',passageId:'关联材料'}[op.field]),original[op.field],op.after,op.reason);
      Object.assign(q,{[op.field]:op.after,confirmed:false});
    }else if(op.kind==='passage'){
      const a=next.passages.find(a=>a.id===op.passageId),original=p.passages.find(a=>a.id===op.passageId);if(!a||!original)throw Error('修正材料不存在');
      const b=op.field==='paragraph'?a.paragraphs.find(b=>b.id===op.blockId):undefined,old=op.field==='pool'?original.pool:original.paragraphs.find(b=>b.id===op.blockId)?.text;
      if(old===undefined||old!==op.before)throw Error('材料修正旧值不符');copied(op.after,refs);
      record('p:'+a.id+':'+(op.field==='pool'?'pool':op.blockId),a.title+' · '+(op.field==='pool'?'选项池':'原文段落'),old,op.after,op.reason);
      if(op.field==='pool')a.pool=op.after;else b!.text=op.after;
    }else if(op.kind==='exclude_duplicate'){
      const q=next.questions.find(q=>q.id===op.questionId);if(!q||q.excluded)throw Error('待排除题目不存在或已排除');
      if(!next.questions.some(x=>x.id!==q.id&&!x.excluded&&same([x.number,x.passageId,x.stem,x.options,x.answer],[q.number,q.passageId,q.stem,q.options,q.answer])))throw Error('只能自动排除内容完全相同的重复题');
      record('q:'+q.id+':exclude','第 '+q.number+' 题 · 排除重复',false,true,op.reason);q.excluded=true;q.confirmed=false;
    }else if(op.kind==='add_question'){
      const a=next.passages.find(a=>a.id===op.passageId);if(!a)throw Error('漏题的关联材料不存在');if(next.questions.some(q=>q.number===op.number&&q.passageId===a.id))throw Error('新增题号已在本组存在');
      copied(op.stem,refs);for(const o of optionEntries(op.options))copied(o.text,refs);
      if(!refs.some(r=>new RegExp('(?:^|\\n)\\s*'+op.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[.．、)]').test(r.quote)))throw Error('新增题目缺少题号依据');
      const q:Question={id:uid(),number:op.number,passageId:a.id,type:a.type,stem:op.stem,options:op.options,answer:op.answer,confirmed:false,excluded:false,stale:false,versions:[]};
      next.questions.push(q);if(op.answer)answerFromSource(next,q,op.answer,refs);else plan.unresolved.push('新增第 '+q.number+' 题缺少明确参考答案，请人工补充');
      newIds.add(q.id);record('new:'+q.id,'补入第 '+q.number+' 题','',q,op.reason);
    }else{
      if(!include)throw Error('本次未选择自动修正讲解');
      const q=next.questions.find(q=>q.id===op.questionId),original=p.questions.find(q=>q.id===op.questionId);if(!q||!original||(original.activeVersion||'')!==op.beforeVersion)throw Error('解析旧版本不匹配');
      const a=next.passages.find(a=>a.id===q.passageId);if(!a)throw Error('解析缺少关联材料');
      const evidence=op.after.evidence.map(r=>resolveEvidence(a.paragraphs,r));
      if(!['writing','continuation'].includes(q.type)&&!q.answer.trim().toLowerCase().split(/\s*(?:\/|;|；)\s*/).includes(op.after.answer.trim().toLowerCase()))throw Error('修正后的解析答案与参考答案不一致');
      const old=original.versions.find(v=>v.id===original.activeVersion);
      let exercise=op.after.exercise||undefined;
      if(!exercise&&old?.exercise&&op.after.practice===old.practice&&op.after.practiceAnswer===old.practiceAnswer)exercise=old.exercise;
      if(!exercise&&(!old||op.after.practice!==old.practice||op.after.practiceAnswer!==old.practiceAnswer))throw Error('修改举一反三必须提供独立英文同类练习，不能写入中文转述');
      if(exercise){exercise=validateExercise(exercise,q.type,[...a.paragraphs.map(b=>b.text),a.pool,q.stem,...q.options]);op.after.practice=exerciseText(exercise);op.after.practiceAnswer=exerciseAnswerText(exercise);}
      record('q:'+q.id+':explanation','第 '+q.number+' 题 · 讲解',old?{answer:old.answer,analysis:old.analysis,evidence:old.evidence,practice:old.practice,practiceAnswer:old.practiceAnswer}:null,op.after,op.reason);
      const v=explanationSchema.parse({...op.after,exercise,evidence,id:uid(),createdAt:new Date().toISOString(),origin:'ai',conflict:false});q.versions.push(v);q.activeVersion=v.id;q.confirmed=false;explanations.push(q.id);
    }
  }
  if(!changes.length&&!plan.unresolved.length)throw Error('AI未返回可执行修改或未处理原因，本次未修改');
  reviseProject(p,next);for(const id of explanations)next.questions.find(q=>q.id===id)!.stale=false;
  const signature=(i:ReturnType<typeof checkIntegrity>[number])=>[i.code,i.questionId,i.passageId,i.sourceId].join(':');
  const existing=new Set(checkIntegrity(p).filter(i=>i.severity==='error').map(signature));
  const introduced=checkIntegrity(next).filter(i=>i.severity==='error'&&!existing.has(signature(i))&&!(i.code==='missing_answer'&&newIds.has(i.questionId||'')));
  if(introduced.length)throw Error('自动修正产生新的完整性问题，整批未保存：'+introduced[0].message);
  next.corrections=[...(p.corrections||[]),{id:uid(),createdAt:new Date().toISOString(),provider:settings.provider,model:settings.model,before,afterFingerprint:correctionFingerprint(next),changes,unresolved:plan.unresolved,recheck:changes.length?'pending':'not_required',recheckError:''}];
  return next;
}

export function undoCorrection(p:Project):Project{
  const record=[...(p.corrections||[])].reverse().find(r=>!r.undoneAt&&r.changes.length);
  if(!record)throw Error('没有可撤销的自动修正');
  if(correctionFingerprint(p)!==record.afterFingerprint)throw Error('自动修正后已继续修改内容，不能覆盖这些编辑；请在修改记录中对照恢复');
  const next=structuredClone(p);next.passages=structuredClone(record.before.passages);next.questions=structuredClone(record.before.questions);next.corrections!.find(r=>r.id===record.id)!.undoneAt=new Date().toISOString();next.updatedAt=new Date().toISOString();return next;
}
