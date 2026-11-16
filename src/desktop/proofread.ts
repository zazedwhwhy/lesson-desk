import {proofreadSystem as system,proofreadInstruction as proofreadPrompt} from '../core/request-instructions';
export {proofreadInstruction as proofreadPrompt} from '../core/request-instructions';
import { callAI } from './ai';
import { uid, type Project, type Settings } from '../core/model';
import { checkIntegrity, createProofreadRequest, proofreadFingerprint, proofreadResultSchema, validateProofreadResult } from '../core/proofread';
import {splitProofreadInput} from '../core/proofread-chunks';
import {resolveEvidence} from '../core/evidence';
import {GenerationContentError} from '../core/errors';




export async function proofreadProject(p: Project, settings: Settings, key: string, includeExplanations: boolean, signal: AbortSignal, onRetry: (message:string)=>void = ()=>{}) {
  if(signal.aborted)throw Error('校对已取消，未替换上次报告');
  if(!p.questions.length)throw Error('请先整理试卷，生成题目后再校对');
  if(!p.sources.some(s=>s.blocks.some(b=>b.text.trim())))throw Error('缺少可对照的原材料，请先上传试卷和答案');
  if(p.sources.some(s=>s.ocrPages?.length))throw Error('扫描页尚未识别，请先完成识别再校对');
  if(checkIntegrity(p).some(i=>i.code==='duplicate_id'))throw Error('题目或材料 ID 重复，请先修正关联再校对');
  const request=createProofreadRequest(p,includeExplanations),chunks=splitProofreadInput(request.input);
  const results:ReturnType<typeof validateProofreadResult>[]=[];
  for(let index=0;index<chunks.length;index++){
    if(signal.aborted)throw Error('校对已取消，未替换上次报告');
    const chunk=chunks[index],input=chunk.input;
    onRetry(`正在校对第 ${index+1}/${chunks.length} 段…`);
    const scope=chunks.length>1?'\n本次为分段校对：只报告本段实际可核实的问题；checkedQuestionIds与checkedSourceIds仅列本段提供的编号。coverage=complete仅表示本段全部核查，不代表全卷。其他段未提供的题目或来源不能判为漏题。上下文不足必须partial并说明。'+(chunk.fragmented?'本段包含长文本片段，不能认定整题或整份来源检查完成。':''):'';
    let raw;
    try{raw=await callAI(settings,key,proofreadResultSchema,proofreadPrompt+scope+'\n待校对资料：\n'+JSON.stringify({...input,...(chunks.length>1?{segment:{index:index+1,total:chunks.length,instructions:scope}}:{})}),signal,message=>onRetry(`第 ${index+1}/${chunks.length} 段：${message}`),system,[],16384);}
    catch(error){
      const size=JSON.stringify(input).length;
      if(!signal.aborted&&error instanceof GenerationContentError&&error.message.includes('本项材料请求被接口拒绝')&&size>8000){
        const smaller=splitProofreadInput(input,Math.floor(size/2)).map(part=>({...part,fragmented:part.fragmented||chunk.fragmented}));
        chunks.splice(index,1,...smaller);index--;onRetry('当前服务的上下文限制较小，正在细分这一段后重试…');continue;
      }
      throw error;
    }
    if(signal.aborted)throw Error('校对已取消，未替换上次报告');
    const qids=new Set(input.questions.map(q=>q.id)),sids=new Set(input.sources.map(s=>s.id)),pids=new Set(input.passages.map(a=>a.id));
    if(raw.checkedQuestionIds.some(id=>!qids.has(id))||raw.checkedSourceIds.some(id=>!sids.has(id)))throw Error(`第${index+1}段校对返回本段未提供的编号，原报告保留`);
    if(raw.coverage==='complete'&&(new Set(raw.checkedQuestionIds).size!==qids.size||new Set(raw.checkedSourceIds).size!==sids.size))throw Error(`第${index+1}段声称完成但有遗漏，原报告保留`);
    for(const f of raw.findings){
      if(f.questionIds.some(id=>!qids.has(id))||f.passageIds.some(id=>!pids.has(id)))throw Error('分段报告引用了未提供的题目或材料');
      for(const ref of f.evidence){const source=input.sources.find(s=>s.id===ref.sourceId);if(!source)throw Error('分段报告引用了未提供的来源');resolveEvidence(source.blocks,ref);}
    }
    const decoded=request.decode(raw);
    // Validate references against the original, while completeness is checked
    // against the actual segment above, then aggregated below.
    const checked=validateProofreadResult(p,{...decoded,coverage:'partial',limitations:decoded.limitations.length?decoded.limitations:['分段范围检查']});
    results.push({...checked,coverage:raw.coverage,limitations:decoded.limitations});
  }
  const limitations=[...new Set(results.flatMap(r=>r.limitations))];
  const fragmented=chunks.some(c=>c.fragmented);
  if(fragmented)limitations.unshift('部分单项文字过长，已分片核查；跨片上下文及整题完整性仍需人工核对。');
  const findings=[...new Map(results.flatMap(r=>r.findings).map(f=>[JSON.stringify(f),f])).values()];
  const result=validateProofreadResult(p,{coverage:!fragmented&&results.every(r=>r.coverage==='complete')?'complete':'partial',checkedQuestionIds:[...new Set(results.flatMap(r=>r.checkedQuestionIds))],checkedSourceIds:[...new Set(results.flatMap(r=>r.checkedSourceIds))],limitations,findings}), next=structuredClone(p);
  next.proofread={id:uid(),createdAt:new Date().toISOString(),provider:settings.provider,model:settings.model,includeExplanations,inputSnapshot:proofreadFingerprint(p,includeExplanations),result};
  return next;
}
