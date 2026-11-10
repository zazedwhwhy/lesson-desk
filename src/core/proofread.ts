import { z } from 'zod';
import type { Project } from './model';
import { resolveEvidence } from './evidence';

const text = z.string().max(3000);
export const proofreadResultSchema = z.object({
  coverage: z.enum(['complete', 'partial']),
  checkedQuestionIds: z.array(z.string()).max(1000), checkedSourceIds: z.array(z.string()).max(200),
  limitations: z.array(text).max(30),
  findings: z.array(z.object({
    category: z.enum(['missing_question', 'duplicate_number', 'missing_options', 'missing_answer', 'answer_mismatch', 'blank_mismatch', 'material_mismatch', 'explanation_issue', 'other']),
    severity: z.enum(['error', 'warning']), questionIds: z.array(z.string()), passageIds: z.array(z.string()),
    description: text, suggestion: text,
    evidence: z.array(z.object({ sourceId: z.string(), blockId: z.string(), quote: z.string().min(1).max(2000) })).max(8)
  })).max(150)
});
export const proofreadReportSchema = z.object({
  id: z.string(), createdAt: z.string(), provider: z.string(), model: z.string(),
  includeExplanations: z.boolean(), inputSnapshot: z.string(), result: proofreadResultSchema
});
export type ProofreadResult = z.infer<typeof proofreadResultSchema>;
export type IntegrityIssue = { id: string; code: string; severity: 'error' | 'warning'; message: string; questionId?: string; passageId?: string; sourceId?: string; blockId?: string };

export function sourceAnswerKeys(p: Project) {
  const keys: { number:string; answer:string; sourceId:string; blockId:string }[]=[];
  for(const s of p.sources.filter(s=>s.role==='answer'))for(const b of s.blocks)for(const line of b.text.split('\n')) {
    const m=line.trim().match(/^(\d{1,3})\s*[-–—~～]\s*(\d{1,3})\s*[:：.．、]?\s*([A-G](?:\s*[A-G])*)$/i);
    if(!m)continue;const first=Number(m[1]),last=Number(m[2]),answers=m[3].replace(/\s/g,'').toUpperCase();
    if(last<first||last-first+1!==answers.length)continue;
    [...answers].forEach((answer,i)=>keys.push({number:String(first+i),answer,sourceId:s.id,blockId:b.id}));
  }
  return keys;
}
export function uniqueSourceAnswer(p: Project, number:string) {
  if(p.questions.filter(q=>q.number===number&&!['writing','continuation'].includes(q.type)).length!==1)return undefined;
  const matches=sourceAnswerKeys(p).filter(k=>k.number===number);
  return matches.length&&new Set(matches.map(k=>k.answer)).size===1?matches[0]:undefined;
}

export function proofreadInput(p: Project, includeExplanations: boolean) {
  return {
    answerIndex: sourceAnswerKeys(p),
    sources: p.sources.map(s => ({ id: s.id, name: s.name, role: s.role, pendingOcrPages: s.ocrPages || [], blocks: s.blocks })),
    passages: p.passages.map(a => ({ id: a.id, title: a.title, type: a.type, paragraphs: a.paragraphs, pool: a.pool })),
    questions: p.questions.map(q => {
      const e = q.versions.find(v => v.id === q.activeVersion);
      return { id: q.id, number: q.number, passageId: q.passageId, type: q.type, stem: q.stem, options: q.options, referenceAnswer: q.answer, excluded: q.excluded,
        ...(includeExplanations ? { explanation: e ? { answer: e.answer, analysis: e.analysis, evidence: e.evidence, practice: e.practice, practiceAnswer: e.practiceAnswer,exercise:e.exercise||null } : null } : {}) };
    })
  };
}
export const proofreadFingerprint = (p: Project, includeExplanations: boolean) => JSON.stringify(proofreadInput(p, includeExplanations));

export function createProofreadRequest(p: Project, includeExplanations: boolean) {
  const input=structuredClone(proofreadInput(p,includeExplanations));
  const questions=new Map<string,string>(),passages=new Map<string,string>(),sources=new Map<string,string>(),blocks=new Map<string,string>();
  const passageForward=new Map<string,string>(),paragraphForward=new Map<string,string>();
  const sourceForward=new Map<string,string>(),blockForward=new Map<string,string>();
  input.sources.forEach((s,i)=>{
    const original=s.id,alias='S'+(i+1);sources.set(alias,s.id);sourceForward.set(original,alias);s.id=alias;
    s.blocks.forEach((b,j)=>{const id=alias+'B'+(j+1);blocks.set(alias+':'+id,b.id);blockForward.set(original+':'+b.id,id);b.id=id;});
  });
  input.answerIndex=input.answerIndex.map(k=>({...k,sourceId:sourceForward.get(k.sourceId)!,blockId:blockForward.get(k.sourceId+':'+k.blockId)!}));
  input.passages.forEach((a,i)=>{
    const original=a.id,alias='P'+(i+1);passages.set(alias,original);passageForward.set(original,alias);a.id=alias;
    a.paragraphs.forEach((b,j)=>{const id=alias+'B'+(j+1);paragraphForward.set(original+':'+b.id,id);b.id=id;});
  });
  input.questions.forEach((q,i)=>{
    const alias='Q'+(i+1);questions.set(alias,q.id);q.id=alias;
    const originalPassage=q.passageId;q.passageId=passageForward.get(originalPassage)||originalPassage;
    if(q.explanation)q.explanation.evidence=q.explanation.evidence.map(ref=>({...ref,blockId:paragraphForward.get(originalPassage+':'+ref.blockId)||ref.blockId}));
  });
  function lookup(map: Map<string,string>,id:string) {const value=map.get(id);if(!value)throw Error(`AI校对返回未知编号 ${id}，报告未保存，请重试`);return value;}
  return {input,decode(raw:unknown){
    const result=proofreadResultSchema.parse(raw);
    result.checkedQuestionIds=result.checkedQuestionIds.map(id=>lookup(questions,id));result.checkedSourceIds=result.checkedSourceIds.map(id=>lookup(sources,id));
    for(const f of result.findings){
      f.questionIds=f.questionIds.map(id=>lookup(questions,id));f.passageIds=f.passageIds.map(id=>lookup(passages,id));
      f.evidence=f.evidence.map(ref=>({...ref,sourceId:lookup(sources,ref.sourceId),blockId:lookup(blocks,ref.sourceId+':'+ref.blockId)}));
    }
    return result;
  }};
}

export function checkIntegrity(p: Project): IntegrityIssue[] {
  const out: IntegrityIssue[] = [];
  function add(code: string, message: string, location: Partial<IntegrityIssue> = {}, severity: 'error' | 'warning' = 'warning') {
    out.push({ id: `${code}-${out.length}`, code, severity, message, ...location });
  }
  if (!p.sources.some(s => s.role === 'paper' && s.blocks.some(b => b.text.trim()))) add('missing_source', '未提供可读取的试卷来源，无法对照原卷检查漏题。');
  const sourceIds=new Set<string>();
  for(const s of p.sources){if(sourceIds.has(s.id)||new Set(s.blocks.map(b=>b.id)).size!==s.blocks.length)add('duplicate_id',`${s.name} 的来源或段落 ID 重复，无法可靠引用。`,{sourceId:s.id},'error');sourceIds.add(s.id);}
  for (const s of p.sources) if (s.ocrPages?.length) add('pending_ocr', `${s.name} 还有 ${s.ocrPages.length} 页未识别。`, { sourceId: s.id }, 'error');
  const questionIds = new Set<string>(), passageIds = new Set<string>();
  for (const a of p.passages) {
    if (passageIds.has(a.id)) add('duplicate_id', '材料 ID 重复，需重新整理或修正关联。', { passageId:a.id }, 'error');
    passageIds.add(a.id);
  }
  for (const q of p.questions) {
    const loc = { questionId:q.id, passageId:q.passageId };
    if (questionIds.has(q.id)) add('duplicate_id', `第 ${q.number} 题 ID 重复，无法可靠关联。`, loc, 'error');
    questionIds.add(q.id);
    if (q.excluded) continue;
    if (!q.number.trim()) add('missing_number', '题号为空。', loc, 'error');
    if (!p.passages.some(a=>a.id===q.passageId)) add('missing_material', `第 ${q.number} 题缺少关联材料。`, loc, 'error');
    if (!q.stem.trim()) add('missing_stem', `第 ${q.number} 题缺少题干。`, loc, 'error');
    if (!q.answer.trim()) add('missing_answer', `第 ${q.number} 题缺少参考答案。`, loc, 'error');
    if (p.questions.some(x=>x.id!==q.id&&!x.excluded&&x.passageId===q.passageId&&x.number===q.number)) add('duplicate_number', `同组第 ${q.number} 题重复，请判断是重复识别还是题号需修改。`, loc, 'error');
    const expectedOptions=q.type==='listening'?3:4;
    if (['reading','listening','cloze'].includes(q.type) && (q.options.length!==expectedOptions || q.options.some(o=>!o.trim()))) add('missing_options', `第 ${q.number} 题识别到 ${q.options.filter(o=>o.trim()).length} 个非空选项；此题型通常为 ${expectedOptions} 项，请对照原题。`, loc);
    if (['reading','listening','cloze'].includes(q.type) && q.answer.trim() && !(q.type==='listening'?/^[A-C]$/i:/^[A-D]$/i).test(q.answer.trim())) add('answer_format', `第 ${q.number} 题答案不是单个 ${q.type==='listening'?'A–C':'A–D'}，请核查选项与答案是否错位或采用其他格式。`, loc);
    const key=uniqueSourceAnswer(p,q.number);
    if(key&&/^[A-G]$/i.test(q.answer.trim())&&q.answer.trim().toUpperCase()!==key.answer)add('source_answer_mismatch',`第 ${q.number} 题当前答案 ${q.answer} 与答案来源的 ${key.answer} 不一致，请确认是否为教师修订或答案错配。`,{...loc,sourceId:key.sourceId,blockId:key.blockId},'error');
  }
  const numbers = [...new Set(p.questions.filter(q=>!['writing','continuation'].includes(q.type)&&/^\d{1,3}$/.test(q.number)).map(q=>Number(q.number)))].sort((a,b)=>a-b);
  for (let i=1;i<numbers.length;i++) if(numbers[i]-numbers[i-1]>1) {
    const from=numbers[i-1]+1, to=numbers[i]-1;
    add('number_gap', `客观题/填空题的题号在 ${from===to?from:`${from}–${to}`} 处不连续；可能是节选或题型重新编号，请对照原卷。`);
  }
  const knownNumbers=new Set(p.questions.map(q=>q.number.trim()));
  const sourceMissing=new Set<string>();
  for(const s of p.sources.filter(s=>s.role==='paper')) for(const b of s.blocks) {
    for(const match of b.text.matchAll(/(?:^|\n)\s*(\d{1,3})[.．、)]\s+/g)) {
      const n=String(Number(match[1]));
      if(!knownNumbers.has(n)&&!sourceMissing.has(n)) {sourceMissing.add(n);add('source_question_missing',`原材料出现编号 ${n}，整理结果未找到同号题目；也可能是原文中的条目编号，请核查。`,{sourceId:s.id,blockId:b.id});}
    }
  }
  for(const a of p.passages) {
    const qs=p.questions.filter(q=>q.passageId===a.id), included=qs.filter(q=>!q.excluded);
    if(!included.length)continue;
    if(['reading','seven','cloze','grammar','listening','continuation'].includes(a.type)&&!a.paragraphs.some(b=>b.text.trim())) add('empty_material',`${a.title} 缺少可读取的原文${a.type==='listening'?'或听力原文':''}。`,{passageId:a.id},'error');
    if(a.type==='seven') {
      const labels=[...a.pool.matchAll(/(?:^|\n)\s*([A-G])[.．、)]\s*/g)].map(m=>m[1]);
      if(new Set(labels).size!==7&&!qs.some(q=>q.options.filter(o=>o.trim()).length===7)) add('missing_options',`${a.title} 的七选五选项池未识别出完整 A–G，请对照原卷。`,{passageId:a.id});
    }
    if(['seven','cloze','grammar'].includes(a.type)) {
      const blanks=[...a.paragraphs.map(b=>b.text).join('\n').matchAll(/_+\s*(\d{1,3})\s*_+|\((\d{1,3})\)\s*_{2,}/g)].map(m=>m[1]||m[2]);
      for(const n of new Set(blanks))if(!qs.some(q=>q.number===n))add('blank_unmatched',`${a.title} 的空位 ${n} 没有关联题目。`,{passageId:a.id},'error');
      if(blanks.length)for(const q of included)if(!blanks.includes(q.number))add('blank_unmatched',`第 ${q.number} 题未在关联原文的已识别空位中找到，请核查空位格式或材料关联。`,{questionId:q.id,passageId:a.id});
    }
  }
  return out;
}

export function validateProofreadResult(p: Project, raw: unknown): ProofreadResult {
  const result=proofreadResultSchema.parse(raw);
  const qids=new Set(p.questions.map(q=>q.id)), sids=new Set(p.sources.map(s=>s.id)), pids=new Set(p.passages.map(a=>a.id));
  if(result.checkedQuestionIds.some(id=>!qids.has(id))||result.checkedSourceIds.some(id=>!sids.has(id)))throw Error('AI校对返回未知的题目或来源 ID，报告未保存');
  if(new Set(result.checkedQuestionIds).size!==result.checkedQuestionIds.length||new Set(result.checkedSourceIds).size!==result.checkedSourceIds.length)throw Error('AI校对覆盖范围含重复 ID，报告未保存');
  if(result.coverage==='complete'&&(result.checkedQuestionIds.length!==qids.size||result.checkedSourceIds.length!==sids.size))throw Error('AI声称校对完成但未覆盖全部题目与来源，报告未保存，请重试');
  if(result.coverage==='partial'&&!result.limitations.length)throw Error('AI未说明校对未完成的范围，报告未保存');
  for(const issue of result.findings) {
    if(!issue.description.trim()||!issue.suggestion.trim())throw Error('AI校对问题描述或建议为空，报告未保存');
    if(issue.questionIds.some(id=>!qids.has(id))||issue.passageIds.some(id=>!pids.has(id)))throw Error('AI校对问题关联无效，报告未保存');
    if(issue.category==='answer_mismatch')for(const id of issue.questionIds){
      const q=p.questions.find(q=>q.id===id)!, key=uniqueSourceAnswer(p,q.number);
      if(key&&q.answer.trim().toUpperCase()===key.answer)throw Error(`第${q.number}题与可直接核验的来源答案一致，AI误报为答案错配；报告未保存，请重试。`);
    }
    issue.evidence=issue.evidence.map(ref=>{
      const source=p.sources.find(s=>s.id===ref.sourceId);if(!source)throw Error('AI校对引用的来源不存在，报告未保存');
      try{return {...ref,...resolveEvidence(source.blocks,ref)};}catch(error){throw Error('AI校对引用未通过原文校验：'+(error instanceof Error?error.message:String(error)));}
    });
  }
  return result;
}
