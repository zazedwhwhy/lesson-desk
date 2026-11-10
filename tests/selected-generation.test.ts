import {it,expect} from 'vitest';
import {demoProject} from '../src/core/demo';
import {generationJobFor,planSelectedGeneration,runGeneration,planGeneration} from '../src/core/generation';
import {generationNotice} from '../src/core/generation-notice';
import {projectSchema} from '../src/core/model';
it('只安排勾选的模块，错误隔离并可恢复，完成项不重复执行',async()=>{
 const original=demoProject();let p=planSelectedGeneration(original,[original.questions[0].id],['analysis','sentences','lexicon']);
 expect(new Set(p.job.tasks!.map(t=>t.kind))).toEqual(new Set(['analysis','sentences','lexicon']));
 expect(generationJobFor(p,'lexicon')!.state).toBe('running');
 p=await runGeneration(p,new AbortController().signal,async(p,t)=>{if(t.kind==='sentences')throw Error('句法无效');return p;},async()=>{});
 expect(generationJobFor(p,'analysis')!.state).toBe('complete');expect(generationJobFor(p,'sentences')!.state).toBe('failed');expect(generationJobFor(p,'lexicon')!.state).toBe('complete');
 expect(projectSchema.parse(p).job.mode).toBe('selected');p=planSelectedGeneration(p,[],['analysis','sentences','lexicon'],true);
 const seen:string[]=[];p=await runGeneration(p,new AbortController().signal,async(p,t)=>{seen.push(t.kind);return p;},async()=>{},true);expect(seen).toEqual(['sentences']);expect(p.job.state).toBe('complete');
});
it('通知区分全部完成、部分失败和取消，不把部分失败报成全部成功',async()=>{
 const original=demoProject();let p=planGeneration(original,[original.questions[0].id],'analysis');p=await runGeneration(p,new AbortController().signal,async()=>{throw Error('字段缺失');},async()=>{});
 expect(generationNotice(p).title).toContain('待处理');expect(generationNotice(p).body).toContain('失败 1 项');p.job.state='cancelled';expect(generationNotice(p).title).toContain('取消');
});
it('拒绝空选择和未知模块，不能意外启动全部生成',()=>{const p=demoProject();expect(()=>planSelectedGeneration(p,[p.questions[0].id],[])).toThrow('勾选');expect(()=>planSelectedGeneration(p,[p.questions[0].id],['lesson' as any])).toThrow('有效');});
