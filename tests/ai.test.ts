import { it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { callAI, generateGroup } from '../src/desktop/ai';
import { demoProject } from '../src/core/demo';
import {demoExercise}from'../src/core/exercise-demo';
import{ServiceStopError}from'../src/core/generation-model';
afterEach(() => vi.unstubAllGlobals());
const s = { provider: 'deepseek' as const, model: 'test', baseUrl: 'https://api.deepseek.com' };
it('401不重试、不切服务商', async () => { const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 })); vi.stubGlobal('fetch', fetch); await expect(callAI(s, 'key', z.object({ text: z.string() }), 'test', new AbortController().signal)).rejects.toThrow('401'); expect(fetch).toHaveBeenCalledTimes(1); });
it.each(['<html>bad gateway</html>',JSON.stringify({error:{code:'unsupported_image'}}),JSON.stringify({error:{code:'invalid_request_error'}})])('未知400错误暂停而非当作材料错误继续：%s',async body=>{const fetch=vi.fn().mockResolvedValue(new Response(body,{status:400}));vi.stubGlobal('fetch',fetch);await expect(callAI(s,'key',z.object({text:z.string()}),'test',new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);expect(fetch).toHaveBeenCalledTimes(1);});
it('空内容不注入默认解析', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: '   ' } }] }))); await expect(callAI(s, 'key', z.object({ text: z.string() }), 'test', new AbortController().signal)).rejects.toThrow('空内容'); });
it('不完整JSON结构不能成为成功结果', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }))); await expect(callAI(s, 'key', z.object({ text: z.string() }), 'test', new AbortController().signal)).rejects.toThrow('结构不符合'); });
it('本项材料超长被400拒绝时不误判全局凭据错误；模型无效才暂停后续任务',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{code:'context_length_exceeded'}},{status:400})));const error=await callAI(s,'key',z.object({text:z.string()}),'test',new AbortController().signal).catch(e=>e);expect(error).not.toBeInstanceOf(ServiceStopError);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{code:'model_not_found'}},{status:400})));await expect(callAI(s,'key',z.object({text:z.string()}),'test',new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
});
it('按原句编号取回原文，避免模型抄写造成空白差异', async () => {
  const p = demoProject(), a = p.passages[0], q = p.questions[0];
  a.paragraphs[0].text = 'Supporting\n families matters.';
  const output = { translation: '支持家庭很重要。', teaching:null,explanations: [{ questionId: q.id, answer: q.answer, analysis: '依据原文。', evidenceIds:['C1'],practiceBlueprint:{kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'} }] };
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]})).mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{id:q.id,exercise:demoExercise()}]})}}]}));vi.stubGlobal('fetch',fetch);
  const result = await generateGroup(p, a.id, [q.id], s, 'key', new AbortController().signal, () => {},false);
  expect(result.questions[0].versions.at(-1)?.evidence[0].quote).toBe('Supporting\n families matters.');
  expect(fetch).toHaveBeenCalledTimes(1); // 解析入口不调用独立出题或讲义接口。
});
it('错误引用明确指出题号，保留原有讲解与翻译', async () => {
  const p = demoProject(), a = p.passages[0], q = p.questions[0], before = structuredClone(p);
  const output = { translation: '不应写入', teaching:null,explanations: [{ questionId: q.id, answer: q.answer, analysis: '新解析', evidenceIds:['fake'],practiceBlueprint:{kind:'reading',skill:demoExercise().skill,sourceTopic:'National parks'} }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] })));
  await expect(generateGroup(p, a.id, [q.id], s, 'key', new AbortController().signal, () => {})).rejects.toThrow('第21题解析失败');
  expect(p).toEqual(before);
});
