import {practiceSystem as system,practiceDetails} from '../core/request-instructions';
import {GenerationContentError} from '../core/errors';
import {callAI}from'./ai';
import {z}from'zod';
import{exerciseSchema,exercisePrompt,validateExercise,assignedExerciseTopic,type ExerciseBlueprint}from'../core/exercise';
import type{Settings}from'../core/model';
import{ServiceStopError}from'../core/generation-model';
import{reviewContent}from'./content-review';
export async function generateIndependentExercises(tasks:{id:string;blueprint:ExerciseBlueprint}[],settings:Settings,key:string,signal:AbortSignal,sourceTexts:string[],onRetry:(message:string)=>void=()=>{},feedback='',topicOffset=0){
  const input=tasks.map((t,i)=>({id:t.id,kind:t.blueprint.kind,skill:t.blueprint.skill,newTopic:assignedExerciseTopic(t.blueprint,i+topicOffset)}));
  const schema=z.object({items:z.array(z.object({id:z.string(),exercise:exerciseSchema}))});
  
  const prompt=exercisePrompt+practiceDetails+"\n独立练习任务：\n"+JSON.stringify(input);
  let raw:z.infer<typeof schema>;
  try{raw=await callAI(settings,key,schema,prompt+(feedback?'\n上次此练习校验失败，请修正：'+feedback:''),signal,onRetry,system,[],tasks.length>=10?32768:16384);}catch(error){if(error instanceof ServiceStopError)throw error;if(error instanceof GenerationContentError)throw new GenerationContentError('独立英文同类练习生成失败：'+error.message,{cause:error});throw error;}
  if(raw.items.length!==tasks.length||new Set(raw.items.map(i=>i.id)).size!==tasks.length||raw.items.some(i=>!tasks.some(t=>t.id===i.id)))throw new GenerationContentError('独立练习返回的题目ID或数量不匹配');
  const items=tasks.map((task,index)=>{const e=raw.items.find(i=>i.id===task.id)!.exercise;if(e.newTopic!==input[index].newTopic||e.skill!==input[index].skill)throw new GenerationContentError('独立练习没有使用指定的新主题或考点');return{id:task.id,exercise:validateExercise(e,task.blueprint.kind,sourceTexts)};});
  await reviewContent('practice',{tasks:input,candidates:items},settings,key,signal,onRetry);
  if(signal.aborted)throw Error('已取消');
  return items;
}
