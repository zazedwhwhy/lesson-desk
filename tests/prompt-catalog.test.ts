import {it,expect,vi,afterEach} from 'vitest';
import {z} from 'zod';
import {promptCatalog} from '../src/core/prompt-catalog';
import {PromptBook,promptBook} from '../src/desktop/prompt-store';
import {callAI} from '../src/desktop/ai';
afterEach(()=>{vi.unstubAllGlobals();promptBook.overrides={};});
it('首次打开即包含全部27种任务，无需任何请求',()=>{
 const entries=new PromptBook().snapshot();expect(entries).toHaveLength(27);
 for(const id of ['sentences','lexicon','structure','imitation','organize','analysis','translation','blueprint','practice','proofread','correction','ocr','special-option_evidence','special-cohesion','special-cloze_chain','special-writing_task','special-continuation','review-structure','review-lexicon','review-practice'])expect(entries.find(e=>e.id===id)?.instruction.trim().length).toBeGreaterThan(20);
});
it.each(promptCatalog().map(e=>[e.id,e] as const))('%s编辑会实际用于API，动态材料与格式保留',async(id,entry)=>{
 promptBook.overrides[id]={instruction:'自定义任务要求',system:'自定义系统要求'};
 const fetch=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]}));vi.stubGlobal('fetch',fetch);
 await callAI({provider:'deepseek',model:'test',baseUrl:'https://api.deepseek.com'},'synthetic',z.object({ok:z.boolean()}),entry.instruction+'\n输入材料：{"source":"original"}',new AbortController().signal,()=>{},entry.system);
 const body=JSON.parse((fetch.mock.calls[0] as any)[1].body);expect(body.messages[0].content).toBe('自定义系统要求');expect(body.messages[1].content).toContain('自定义任务要求\n输入材料：{"source":"original"}');expect(body.messages[1].content).toContain('输出必须为json');
});
it('解析模板修改仍保留前置修正反馈',()=>{const b=new PromptBook(),entry=promptCatalog().find(e=>e.id==='analysis')!;b.overrides.analysis={instruction:'新要求',system:'教师'};expect(b.compose('上次失败：引用C999不存在\n'+entry.instruction+'\n输入：{}',entry.system).prompt).toBe('上次失败：引用C999不存在\n新要求\n输入：{}');});
