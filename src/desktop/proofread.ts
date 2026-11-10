import {proofreadSystem as system,proofreadInstruction as proofreadPrompt} from '../core/request-instructions';
export {proofreadInstruction as proofreadPrompt} from '../core/request-instructions';
import { callAI } from './ai';
import { uid, type Project, type Settings } from '../core/model';
import { checkIntegrity, createProofreadRequest, proofreadFingerprint, proofreadResultSchema, validateProofreadResult } from '../core/proofread';




export async function proofreadProject(p: Project, settings: Settings, key: string, includeExplanations: boolean, signal: AbortSignal, onRetry: (message:string)=>void = ()=>{}) {
  if(signal.aborted)throw Error('校对已取消，未替换上次报告');
  if(!p.questions.length)throw Error('请先整理试卷，生成题目后再校对');
  if(!p.sources.some(s=>s.blocks.some(b=>b.text.trim())))throw Error('缺少可对照的原材料，请先上传试卷和答案');
  if(p.sources.some(s=>s.ocrPages?.length))throw Error('扫描页尚未识别，请先完成识别再校对');
  if(checkIntegrity(p).some(i=>i.code==='duplicate_id'))throw Error('题目或材料 ID 重复，请先修正关联再校对');
  const request=createProofreadRequest(p,includeExplanations), json=JSON.stringify(request.input);
  if(json.length>160000)throw Error('本次校对材料超过16万字符，请分成较小课件后校对；本次未发送API请求');
  const raw=await callAI(settings,key,proofreadResultSchema,proofreadPrompt+'\n待校对资料：\n'+json,signal,onRetry,system,[],16384);
  if(signal.aborted)throw Error('校对已取消，未替换上次报告');
  const result=validateProofreadResult(p,request.decode(raw)), next=structuredClone(p);
  next.proofread={id:uid(),createdAt:new Date().toISOString(),provider:settings.provider,model:settings.model,includeExplanations,inputSnapshot:proofreadFingerprint(p,includeExplanations),result};
  return next;
}
