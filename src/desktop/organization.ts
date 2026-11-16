import {englishQuestionSourceId,missingOrganizationTargets,organizationNumber,organizationScopes,targetLabel,type OrganizationTarget} from '../core/organization-coverage';
import {GenerationContentError,isContentError} from '../core/errors';
import {ServiceStopError} from '../core/generation-model';
import {uid,type Project} from '../core/model';

export type OrganizationOptions={recover?:boolean;onStatus?:(message:string)=>void};
type Request=(p:Project,targets?:OrganizationTarget[])=>Promise<Project>;
function mergeMissing(next:Project,candidate:Project,targets:OrganizationTarget[]){
 const order=organizationScopes(next).flatMap(scope=>scope.targets);
 const position=(sourceId:string|undefined,number:string,type?:string)=>{const i=order.findIndex(t=>t.sourceId===sourceId&&(t.number?organizationNumber(number)===t.number:type===t.type));return i<0?Infinity:i;};
 const insert=<T>(list:T[],item:T,rank:(item:T)=>number)=>{const at=list.findIndex(old=>rank(old)>rank(item));list.splice(at<0?list.length:at,0,item);};
 if(next.subject==='chemistry'){
  for(const q of candidate.chemistry!.questions){
   if(!targets.some(t=>t.sourceId===q.sourceId&&t.number===organizationNumber(q.number))||next.chemistry!.questions.some(old=>old.sourceId===q.sourceId&&organizationNumber(old.number)===organizationNumber(q.number)))continue;
   insert(next.chemistry!.questions,{...q,id:uid()},item=>position(item.sourceId,item.number));
  }
 }else{
  const passages=new Map<string,string>();
  for(const q of candidate.questions){
   const sourceId=englishQuestionSourceId(candidate,q);
   if(!targets.some(t=>t.sourceId===sourceId&&(t.number?organizationNumber(q.number)===t.number:q.type===t.type))||next.questions.some(old=>englishQuestionSourceId(next,old)===sourceId&&organizationNumber(old.number)===organizationNumber(q.number)&&old.type===q.type))continue;
   const passage=candidate.passages.find(a=>a.id===q.passageId)!;
   let id=passages.get(passage.id);
   if(!id){
    const old=next.passages.find(a=>next.questions.some(q=>q.passageId===a.id&&englishQuestionSourceId(next,q)===sourceId)&&a.type===passage.type&&a.pool===passage.pool&&JSON.stringify(a.paragraphs.map(b=>b.text))===JSON.stringify(passage.paragraphs.map(b=>b.text)));
    id=old?.id||uid();if(!old)next.passages.push({...passage,id});passages.set(passage.id,id);
   }
   insert(next.questions,{...q,id:uid(),passageId:id,sourceId},item=>position(englishQuestionSourceId(next,item),item.number,item.type));
  }
 }
 next.sourceFidelityIssues=[...(next.sourceFidelityIssues||[]),...(candidate.sourceFidelityIssues||[])];
}
/** Accept valid items independently, but never label a partial response as a
 * complete exam. Recovery adds missing items without replacing teacher work. */
export async function organizeWithCoverage(p:Project,signal:AbortSignal,request:Request,options:OrganizationOptions={}){
 const scopes=organizationScopes(p),status=options.onStatus||(()=>{});
 let next=structuredClone(p),stopped=false;
 const failures:string[]=[];
 if(!options.recover){
  status('正在整理试卷，完成后将对照原卷检查漏题');
  try{next=await request(p);}catch(error){
   if(signal.aborted||error instanceof ServiceStopError||!(error instanceof GenerationContentError)||!scopes.length)throw error;
   status('整卷返回不完整，改为分段整理');
  }
 }
 for(const scope of scopes){
  let missing=missingOrganizationTargets(next,scope.targets);
  if(!missing.length)continue;
  if(stopped){failures.push(scope.title+'：服务中断，此段尚未补齐');continue;}
  let failure='';
  for(let attempt=0;attempt<2&&missing.length;attempt++){
   if(signal.aborted)throw Error('整理已取消，原课件保留');
   status(`${attempt?'重试':'补齐'}：${scope.title} · ${missing.map(targetLabel).join('、')}`);
   const part=structuredClone(p);part.sources=[scope.source,...p.sources.filter(s=>s.role!=='paper')];
   try{
    const candidate=await request(part,missing);
    if(signal.aborted)throw Error('整理已取消，原课件保留');
    mergeMissing(next,candidate,missing);failure='';
   }catch(error){
    if(signal.aborted||!(error instanceof ServiceStopError)&&!isContentError(error))throw error;
    failure=error instanceof Error?error.message:String(error);
    if(error instanceof ServiceStopError){stopped=true;break;}
   }
   missing=missingOrganizationTargets(next,scope.targets);
  }
  if(failure)failures.push(scope.title+'：'+failure);
 }
 if(signal.aborted)throw Error('整理已取消，原课件保留');
 const remaining=scopes.flatMap(scope=>{const missing=missingOrganizationTargets(next,scope.targets);return missing.length?[scope.title+'：尚未整理 '+missing.map(targetLabel).join('、')]:[];});
 next.organizationIssues=[...remaining,...failures];
 if(!scopes.length)next.organizationIssues.push('原材料中未找到可自动核对的明确题号，请对照原卷人工确认是否漏题。');
 if(!(next.subject==='chemistry'?next.chemistry!.questions.length:next.questions.length))throw new GenerationContentError('未整理出有效题目，原课件保留。'+next.organizationIssues.join('；'));
 status(next.organizationIssues.length?'整理结果已保存，仍有遗漏或待核实项，请查看整理报告':(next.subject==='chemistry'?'整理完成，已覆盖原材料中检测到的题号；请继续核对公式与题图':'整理完成，已覆盖原材料中检测到的题号和写作任务'));
 return next;
}
