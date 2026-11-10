import {it,expect} from 'vitest';
import {PromptBook} from '../src/desktop/prompt-store';
import {teachingInstructions} from '../src/core/teaching-instructions';
it('浙江教学范围用于实际模板且不强称官方考纲',()=>{expect(teachingInstructions('sentences')).toContain('浙江');expect(teachingInstructions('lexicon')).toContain('熟词生义');});
it('修改任务要求后仍保留原文与修正反馈',()=>{const b=new PromptBook();b.overrides.lexicon={instruction:'按高一基础筛选',system:'英语教师'};const r=b.compose('默认要求。本次仅生成lexicon字段\n输入材料：{"text":"original"}\n上次失败：词形不符','默认系统');expect(r.prompt).toBe('按高一基础筛选\n输入材料：{"text":"original"}\n上次失败：词形不符');expect(r.system).toBe('英语教师');});
it('不同模块不共用覆盖，恢复默认后使用内置任务',()=>{const b=new PromptBook();b.overrides.lexicon={instruction:'词汇自定义',system:'教师'};expect(b.compose('本次仅生成structure字段\n输入材料：{}','系统').prompt).toContain('structure');delete b.overrides.lexicon;expect(b.compose('本次仅生成lexicon字段\n输入材料：{}','系统').prompt).toContain('lexicon');});
it('校对材料和扫描页码保留为动态数据，不混入可编辑模板',()=>{const b=new PromptBook();b.overrides.proofread={instruction:'校对新要求',system:'系统'};expect(b.compose('校对原要求\n待校对资料：\n{"paper":"original"}','系统').prompt).toBe('校对新要求\n待校对资料：\n{"paper":"original"}');b.overrides.ocr={instruction:'识别新要求',system:'系统'};expect(b.compose('转录这一页试卷。当前第3页。','系统').prompt).toBe('识别新要求当前第3页。');});
