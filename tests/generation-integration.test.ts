import{it,expect,vi,afterEach}from'vitest';
import{demoProject}from'../src/core/demo';
import{demoGeneratedPart}from'../src/core/teaching-demo';
import{demoExercise}from'../src/core/exercise-demo';
import{planGeneration,runGeneration}from'../src/core/generation';
import{generationExecutor}from'../src/desktop/generation-service';
import{bindTokenRange}from'../src/desktop/teaching-parts';
afterEach(()=>vi.unstubAllGlobals());
const settings={provider:'deepseek' as const,model:'mock',baseUrl:'https://api.deepseek.com'};
it('句法两次校验失败时继续保存练习、其他模块和专项，重试只生成句法',async()=>{
 let p=demoProject();delete p.passages[0].learning;let bad=true;const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const text=JSON.parse(init.body).messages[1].content;let raw:any;
 if(text.includes('仅生成原题解析')){calls.push('analysis');const input=JSON.parse(text.split('\n输入：')[1].split('\n输出必须')[0]);raw={explanations:input.questions.map((q:any)=>({questionId:q.id,answer:q.referenceAnswer,analysis:'原文动植物多样性对应biodiversity。',evidenceIds:['C1'],practiceBlueprint:{kind:q.type,skill:demoExercise().skill,sourceTopic:'National parks'}}))};}
 else if(text.includes('仅提炼此题')){calls.push('blueprint');raw={kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'};}
 else if(text.includes('独立练习任务：')){calls.push('practice');const tasks=JSON.parse(text.split('独立练习任务：\n')[1].split('\n输出必须')[0]);raw={items:tasks.map((t:any)=>({id:t.id,exercise:{...demoExercise(),kind:t.kind,skill:t.skill,newTopic:t.newTopic}}))};}
 else if(text.startsWith('教学内容复核：')){raw={issues:[]};}
 else if(text.includes('只逐段翻译')){calls.push('translation');raw={translation:'大雾山以动植物多样性闻名。'};}
 else if(text.includes('本次仅生成')){const module=text.match(/本次仅生成(\w+)字段/)![1] as Parameters<typeof demoGeneratedPart>[0];calls.push(module);const input=JSON.parse(text.split('输入材料：')[1].split('\n输出必须')[0].split('\n上一次')[0]);raw=demoGeneratedPart(module,input.questions);if(module==='sentences'&&bad)raw.sentences[0].parts[0].startToken=500;}
 else{calls.push('special');const input=JSON.parse(text.split('输入材料：\n')[1].split('\n输出必须')[0]);raw={status:'needs_review',notices:['模拟课堂验证结果'],items:input.questions.map((q:any)=>({question_id:q.question_id,question_number:q.question_number,reference_answer:q.reference_answer,question_type:'细节',key_reason:'同义对应',options:q.options.map((o:any)=>({label:o.label,verdict:'uncertain',evidence:[],reasoning:'需核对',error_pattern:''})),teacher_question:'找出原句。'}))};}
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});}));
 p=planGeneration(p,[p.questions[0].id],'lesson');const signal=new AbortController().signal;
 p=await runGeneration(p,signal,generationExecutor(settings,'mock',signal,()=>{}),async()=>{});
 expect(p.job.state).toBe('partial');expect(p.questions[0].versions.at(-1)?.exercise?.kind).toBe('reading');expect(p.passages[0].learning!.versions.at(-1)!.completedModules).toEqual(expect.arrayContaining(['transfer','structure','lexicon','imitation']));expect(p.job.tasks!.filter(t=>t.state==='failed').map((t:any)=>t.kind)).toEqual(['sentences']);expect(calls.filter(k=>k==='sentences')).toHaveLength(2);
 const before=calls.length;bad=false;p=await runGeneration(p,signal,generationExecutor(settings,'mock',signal,()=>{}),async()=>{},true);expect(p.job.tasks!.find(t=>t.kind==='sentences')!.error).toBe('');expect(calls.slice(before)).toEqual(['sentences']);expect(p.job.state).toBe('complete');expect(p.passages[0].learning!.versions.at(-1)!.data.sentences[0].parts![0].text).toBe('Great Smoky Mountains');
});
it('词序号恢复原文缩写而非让模型展开缩写，也拒绝越界',()=>{expect(bindTokenRange("I'm afraid I can't.",1,2)).toBe("I'm afraid");expect(bindTokenRange("I'm afraid I can't.",4,4)).toBe("can't.");expect(()=>bindTokenRange("I'm afraid.",1,500)).toThrow('范围无效');});
it('一个解析引用错误只修正该题，保留同批其他题，不让有效解析陪着重跑',async()=>{
 let p=demoProject();p.questions[0].versions=[];p.questions[0].activeVersion=undefined;p.questions.push({...structuredClone(p.questions[0]),id:'second-q',number:'22'});const first=p.questions[0].id,requests:string[][]=[],texts:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const text=JSON.parse(init.body).messages[1].content,input=JSON.parse(text.split('\n输入：')[1].split('\n输出必须')[0]);texts.push(text);requests.push(input.questions.map((q:any)=>q.id));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({explanations:input.questions.map((q:any)=>({questionId:q.id,answer:q.referenceAnswer,analysis:'有效原题解析',evidenceIds:[q.id===first?'fake500':'C1'],practiceBlueprint:{kind:'reading',skill:'细节理解',sourceTopic:'National parks'}}))})}}]});}));
 p=planGeneration(p,p.questions.map(q=>q.id),'analysis');const signal=new AbortController().signal;p=await runGeneration(p,signal,generationExecutor(settings,'mock',signal,()=>{}),async()=>{});
 expect(p.questions[0].versions).toHaveLength(0);expect(p.questions[1].versions).toHaveLength(1);expect(p.job.done).toEqual(['second-q']);expect(requests).toEqual([[first,'second-q'],[first]]);expect(p.job.state).toBe('partial');expect(texts[1]).toContain('fake500');
});
