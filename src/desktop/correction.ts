import {correctionSystem as system,correctionInstruction as correctionPrompt} from '../core/request-instructions';
export {correctionInstruction as correctionPrompt} from '../core/request-instructions';
import { callAI } from './ai';
import { applyCorrections, correctionPlanSchema, createCorrectionRequest } from '../core/correction';
import { checkIntegrity } from '../core/proofread';
import type { Project, Settings } from '../core/model';
import {exercisePrompt}from'../core/exercise';




export async function generateCorrections(p:Project,s:Settings,key:string,include:boolean,signal:AbortSignal,onRetry:(m:string)=>void=()=>{}){
  if(signal.aborted)throw Error('自动修正已取消，未修改');
  if(p.sources.some(s=>s.ocrPages?.length))throw Error('请先完成扫描页识别');
  if(checkIntegrity(p).some(i=>i.code==='duplicate_id'))throw Error('内部ID重复，无法安全自动修正，请重新整理');
  const request=createCorrectionRequest(p,include),json=JSON.stringify(request.input);
  if(json.length>160000)throw Error('自动修正材料超过16万字符，请拆分课件；未发送请求');
  const raw=await callAI(s,key,correctionPlanSchema,correctionPrompt+'\n自动修正资料：\n'+json,signal,onRetry,system,[],16384);
  if(signal.aborted)throw Error('自动修正已取消，未修改');
  return applyCorrections(p,request.decode(raw),s,include);
}
