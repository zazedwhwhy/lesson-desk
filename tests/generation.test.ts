import{it,expect}from'vitest';
import{demoProject}from'../src/core/demo';
import{planGeneration,runGeneration,ServiceStopError}from'../src/core/generation';
it('某项内容错误即使含500也不阻断后续模块和文章，并逐项保存',async()=>{
 let p=demoProject();delete p.passages[0].learning;p.passages.push({...structuredClone(p.passages[0]),id:'second',title:'下一篇'});p.questions.push({...structuredClone(p.questions[0]),id:'next-q',passageId:'second',number:'24'});p=planGeneration(p,p.questions.map(q=>q.id),'lesson');const seen:string[]=[],saved:string[][]=[];
 p=await runGeneration(p,new AbortController().signal,async(p,t)=>{seen.push(t.id);if(t.kind==='sentences')throw Error('引用C500中的句法成分无效');return p;},async p=>{saved.push(p.job.tasks!.filter(t=>t.state==='complete').map(t=>t.id));});
 expect(p.job.tasks!.find(t=>t.kind==='sentences')?.state).toBe('failed');expect(p.job.tasks!.find(t=>t.kind==='imitation')?.state).toBe('complete');expect(seen).toHaveLength(p.job.tasks!.length);expect(saved.length).toBeGreaterThan(2);expect(p.job.state).toBe('partial');
 const complete=p.job.tasks!.filter(t=>t.state==='complete').map(t=>t.id);const retried:string[]=[];
 p=await runGeneration(p,new AbortController().signal,async(p,t)=>{retried.push(t.id);return p;},async()=>{},true);expect(retried).toHaveLength(2);expect(retried.some(id=>complete.includes(id))).toBe(false);expect(p.job.state).toBe('complete');expect(seen.some(id=>id.startsWith('second:imitation'))).toBe(true);
});
it('服务凭据错误才停止，并保留未执行项供继续，成功内容不重跑',async()=>{
 let p=demoProject();delete p.passages[0].learning;p=planGeneration(p,[p.questions[0].id],'lesson');let calls=0;
 p=await runGeneration(p,new AbortController().signal,async(p)=>{if(++calls===2)throw new ServiceStopError('凭据无效');return p;},async()=>{});
 expect(calls).toBe(2);expect(p.job.tasks!.filter(t=>t.state==='pending').length).toBeGreaterThan(0);expect(p.job.stopReason).toBe('凭据无效');
 const seen:string[]=[];p=await runGeneration(p,new AbortController().signal,async(p,t)=>{seen.push(t.id);return p;},async()=>{},true);expect(seen).not.toContain(p.job.tasks![0].id);expect(p.job.state).toBe('complete');
});
it('生成解析计划只含解析，取消后保留未执行部分',async()=>{
 let p=demoProject();delete p.passages[0].learning;p=planGeneration(p,[p.questions[0].id],'analysis');expect(p.job.tasks!.every(t=>t.kind==='analysis')).toBe(true);const c=new AbortController();c.abort();p=await runGeneration(p,c.signal,async p=>p,async()=>{});expect(p.job.state).toBe('cancelled');expect(p.job.tasks![0].state).toBe('pending');
});
it('恢复时拒绝已取消核对的题目，不发起请求',async()=>{let p=demoProject();p=planGeneration(p,[p.questions[0].id],'analysis');p.questions[0].confirmed=false;let calls=0;await expect(runGeneration(p,new AbortController().signal,async p=>{calls++;return p;},async()=>{},true)).rejects.toThrow('核对');expect(calls).toBe(0);});
