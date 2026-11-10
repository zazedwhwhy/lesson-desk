import {reviewCriteria as criteria,reviewDetails,reviewSystem} from '../core/request-instructions';
import {GenerationContentError} from '../core/errors';
import {z} from 'zod';
import {callAI} from './ai';
import type {Settings} from '../core/model';

const schema=z.object({issues:z.array(z.object({location:z.string().trim().min(1),problem:z.string().trim().min(1),suggestion:z.string().trim().min(1)})).max(8)});


// This is a fresh request: only explicit content errors block a candidate.
// Model review is an extra quality check, not proof of correctness.
export async function reviewContent(kind:keyof typeof criteria,input:unknown,settings:Settings,key:string,signal:AbortSignal,onStatus:(s:string)=>void){
 onStatus('正在复核'+({structure:'篇章脉络',lexicon:'词汇手账',practice:'考点演练'}[kind])+'的内容依据');
 const result=await callAI(settings,key,schema,'教学内容复核：'+kind+'\n'+criteria[kind]+reviewDetails+"\n待复核资料："+JSON.stringify(input),signal,onStatus,reviewSystem,[],4096);
 if(result.issues.length)throw new GenerationContentError('内容复核未通过：'+result.issues.map(i=>i.location+'：'+i.problem+'；建议：'+i.suggestion).join('\n'));
}
