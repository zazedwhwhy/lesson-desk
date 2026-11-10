import { expect, it, vi, afterEach } from 'vitest';
import { generateGroup } from '../src/desktop/ai';
import { validateTeaching } from '../src/core/learning';
import { demoProject } from '../src/core/demo';
import { demoTeaching,demoGeneratedTeaching } from '../src/core/teaching-demo';
import {demoExercise}from'../src/core/exercise-demo';
import{generateIndependentExercises}from'../src/desktop/exercises';

afterEach(()=>vi.unstubAllGlobals());
const s={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
it('截图中的中文主旨提问不能作为英语同类练习保存',async()=>{
  const p=demoProject(),q=p.questions[0];
  const output={translation:'译文',teaching:null,explanations:[{questionId:q.id,answer:q.answer,analysis:'依据原文。',evidenceIds:[],practiceBlueprint:{kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'}}]};
  const bad={...demoExercise(),stem:'主旨题练习：某文分段介绍“水温、热身、抽筋处理、游后冲洗”，问主旨。选项：A. 比较不同泳池；B. 宣传安全游泳；C. 介绍新泳池；D. 解释抽筋原因。答案应选什么？'};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{id:q.id,exercise:bad}]})}}]})));
  await expect(generateIndependentExercises([{id:q.id,blueprint:output.explanations[0].practiceBlueprint as any}],s,'test-key',new AbortController().signal,[])).rejects.toThrow(/练习|practice|同类/);
});
it('空主干和泛泛拆解不能被当成完整句法分析',()=>{
  const p=demoProject(),data=demoTeaching();data.sentences[0].trunk='';data.sentences[0].clauses='找主干，再看修饰。';
  expect(()=>validateTeaching(data,p.passages[0].paragraphs)).toThrow(/主干|句法/);
});
it('生成解析不会额外生成讲义；完整讲义由独立任务负责',async()=>{
  const p=demoProject(),q=p.questions[0];delete p.passages[0].learning;
  const output={translation:'译文',teaching:demoGeneratedTeaching(),explanations:[{questionId:q.id,answer:q.answer,analysis:'依据原文。',evidenceIds:[],practiceBlueprint:{kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'}}]};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]})).mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{id:q.id,exercise:demoExercise()}]})}}]})));
  const result=await generateGroup(p,p.passages[0].id,[q.id],s,'test-key',new AbortController().signal,()=>{});
  expect(result.passages[0].learning).toBeUndefined();expect(result.questions[0].versions.at(-1)?.analysis).toBe('依据原文。');expect(fetch).toHaveBeenCalledTimes(1);
});
it('应用文解析不编造精读模块，也不携带旧阅读题练习',async()=>{
 const p=demoProject(),a=p.passages[0],q=p.questions[0];a.type='writing';a.paragraphs=[];delete a.learning;q.type='writing';q.answer='Official sample';
 const exercise={...demoExercise(),kind:'writing',skill:'邀请信',material:'The school science club is preparing an exhibition next Friday afternoon. Members will display their projects in the school hall and explain their discoveries to visitors.',stem:'Write an email inviting an exchange student. Mention the time, place and one activity.',options:[],answer:'Dear Alex, I would like to invite you to our science exhibition next Friday afternoon. It will take place in the school hall. Our club members will display their projects and explain what they have discovered. You can also try a simple experiment with us. I hope you can come and share this interesting afternoon with us. Yours, Li Hua'};
 const raw={translation:'',teaching:null,explanations:[{questionId:q.id,answer:q.answer,analysis:'按题目要求覆盖邀请、时间地点及活动。',evidenceIds:[],practiceBlueprint:{kind:'writing',skill:'邀请信',sourceTopic:'Invitation letter'}}]};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]})).mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{id:q.id,exercise}]})}}]})));
 const next=await generateGroup(p,a.id,[q.id],s,'test-key',new AbortController().signal,()=>{});expect(next.passages[0].learning).toBeUndefined();expect(next.questions[0].versions.at(-1)?.exercise).toBeUndefined();
});
it('生成解析不因无关句法成分错误而丢弃已经返回的解析',async()=>{
 const p=demoProject(),q=p.questions[0];delete p.passages[0].learning;const teaching=demoGeneratedTeaching();teaching.sentences[0].parts[0].text='This is not a source fragment';
 const raw={translation:'译文',teaching,explanations:[{questionId:q.id,answer:q.answer,analysis:'已生成的正确原题解析',evidenceIds:[],practiceBlueprint:{kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'}}]};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]})).mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{id:q.id,exercise:demoExercise()}]})}}]})));
 const next=await generateGroup(p,p.passages[0].id,[q.id],s,'test-key',new AbortController().signal,()=>{});
 expect(next.questions[0].versions.at(-1)?.analysis).toBe('已生成的正确原题解析');
});
