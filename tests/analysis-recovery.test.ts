import {runParallelGeneration} from '../src/desktop/parallel-generation';
import {it,expect,vi,afterEach} from 'vitest';
import {demoProject} from '../src/core/demo';
import {planGeneration} from '../src/core/generation';
import {generationExecutor} from '../src/desktop/generation-service';
import {callAI} from '../src/desktop/ai';
import {z} from 'zod';
const settings={provider:'deepseek' as const,model:'mock',baseUrl:'https://api.deepseek.com'};
const response=(content:string)=>Response.json({choices:[{finish_reason:'stop',message:{content}}]});
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const p=demoProject();p.questions=[p.questions[0],{...structuredClone(p.questions[0]),id:'q22',number:'22'}];for(const q of p.questions){q.answer='B';q.versions=[];delete q.activeVersion;}return planGeneration(p,p.questions.map(q=>q.id),'analysis');}
const row=(id:string)=>({questionId:id,answer:'B',analysis:'依据所提供的原文与参考答案分析。',evidenceIds:['C1']});
it('批量回复漏证据字段时保存合格题，只修正缺字段题；解析不再依赖练习蓝图',async()=>{
 const p=fixture(),[q1,q2]=p.questions;const broken:any=row(q1.id);delete broken.evidenceIds;
 const fetch=vi.fn().mockResolvedValueOnce(response(JSON.stringify({explanations:[broken,row(q2.id)]}))).mockResolvedValueOnce(response(JSON.stringify({explanations:[row(q1.id)]})));vi.stubGlobal('fetch',fetch);
 const signal=new AbortController().signal,result=await runParallelGeneration(p,signal,generationExecutor(settings,'mock',signal),async()=>{});
 expect(result.job.state).toBe('complete');expect(result.questions.map(q=>q.versions.length)).toEqual([1,1]);expect(fetch).toHaveBeenCalledTimes(2);
 const repair=JSON.parse(fetch.mock.calls[1][1].body).messages[1].content;expect(repair).toContain(q1.id);expect(repair).not.toContain('"id":"'+q2.id+'"');expect(repair).toContain('evidenceIds');
});
it('批量无效JSON转为逐题有界修正，不丢弃后续题目',async()=>{
 const p=fixture(),[q1,q2]=p.questions;const fetch=vi.fn().mockResolvedValueOnce(response('{broken')).mockResolvedValueOnce(response(JSON.stringify({explanations:[row(q1.id)]}))).mockResolvedValueOnce(response(JSON.stringify({explanations:[row(q2.id)]})));vi.stubGlobal('fetch',fetch);
 const signal=new AbortController().signal,result=await runParallelGeneration(p,signal,generationExecutor(settings,'mock',signal),async()=>{});expect(result.job.state).toBe('complete');expect(fetch).toHaveBeenCalledTimes(3);
});
it('只剥除包裹完整JSON的代码围栏，不从混杂文字猜取内容',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response('```json\n{"text":"完整内容"}\n```')).mockResolvedValueOnce(response('说明：{"text":"不可猜取"}')));
 expect(await callAI(settings,'mock',z.object({text:z.string()}),'test',new AbortController().signal)).toEqual({text:'完整内容'});
 await expect(callAI(settings,'mock',z.object({text:z.string()}),'test',new AbortController().signal)).rejects.toThrow('JSON');
});
it('取消单题修正仍保留同批已合格题，不再发后续请求',async()=>{
 const p=fixture(),[q1,q2]=p.questions,c=new AbortController();const broken:any=row(q1.id);delete broken.evidenceIds;
 const fetch=vi.fn().mockResolvedValueOnce(response(JSON.stringify({explanations:[broken,row(q2.id)]}))).mockImplementationOnce(()=>{c.abort();throw Error('已取消');});vi.stubGlobal('fetch',fetch);
 const result=await runParallelGeneration(p,c.signal,generationExecutor(settings,'mock',c.signal),async()=>{});expect(result.job.state).toBe('cancelled');expect(result.questions[1].versions).toHaveLength(1);expect(result.job.done).toEqual([q2.id]);expect(result.job.tasks![0].state).toBe('pending');expect(fetch).toHaveBeenCalledTimes(2);
});
it('单题持续无效JSON最多自动修正一次，不能无限循环',async()=>{
 const p=fixture(),fetch=vi.fn(async()=>response('{broken'));vi.stubGlobal('fetch',fetch);const signal=new AbortController().signal;
 const result=await runParallelGeneration(p,signal,generationExecutor(settings,'mock',signal),async()=>{});expect(result.job.state).toBe('failed');expect(result.questions.every(q=>q.versions.length===0)).toBe(true);expect(fetch).toHaveBeenCalledTimes(3);
});

it('同篇八道已核对题只发两次请求，每题独立保存一个版本',async()=>{
 const p=fixture(),base=p.questions[0];
 p.questions=Array.from({length:8},(_,i)=>({...structuredClone(base),id:'target-'+i,number:String(i+1)}));
 const requests:string[][]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
  const prompt=JSON.parse(init.body).messages[1].content;
  const ids=p.questions.filter(q=>prompt.includes('"id":"'+q.id+'"')).map(q=>q.id);requests.push(ids);
  return response(JSON.stringify({explanations:ids.map(row)}));
 }));
 const signal=new AbortController().signal;
 const result=await runParallelGeneration(planGeneration(p,p.questions.map(q=>q.id),'analysis'),signal,generationExecutor(settings,'mock',signal),async()=>{});
 expect(requests.map(ids=>ids.length)).toEqual([4,4]);expect(result.job.state).toBe('complete');
 expect(result.questions.every(q=>q.versions.length===1)).toBe(true);
});
