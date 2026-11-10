import {afterEach,expect,it,vi} from 'vitest';
import {demoProject} from '../src/core/demo';
import {demoGeneratedPart} from '../src/core/teaching-demo';
import {generateTeachingPart} from '../src/desktop/teaching-parts';
import {generateIndependentExercises} from '../src/desktop/exercises';
import {demoExercise} from '../src/core/exercise-demo';
import {vocabularyRecall} from '../src/core/learning';
import {bindStructure,bindLexicon,structureGenerationSchema,lexiconGenerationSchema} from '../src/core/teaching-quality';
import {createCitationCatalog} from '../src/core/evidence';
import {projectSchema} from '../src/core/model';
import {buildDeck} from '../src/core/logic';
import {commitTeachingModule} from '../src/desktop/teaching-parts';
import {GenerationContentError,friendlyError} from '../src/core/errors';

const settings={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
const response=(data:unknown)=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});
afterEach(()=>vi.unstubAllGlobals());
const cleanReview={issues:[]};

it('拒绝词条不在引用原句内的生成结果，不污染已有讲义',async()=>{
 const p=demoProject(),before=JSON.stringify(p),raw=demoGeneratedPart('lexicon') as any;
 raw.lexicon[0].term='imaginary';raw.lexicon[0].sourceForm='imaginary';
 vi.stubGlobal('fetch',vi.fn(async()=>response(raw)));
 await expect(generateTeachingPart(p,p.passages[0].id,'lexicon',[p.questions[0].id],settings,'test',new AbortController().signal)).rejects.toThrow(/原文形态|词条/);
 expect(JSON.stringify(p)).toBe(before);
});
it('原文回忆遮住同一个词的所有出现，题面不残留答案',()=>{
 const r=vocabularyRecall('variety','A variety of birds brings a variety of colours.','多样性','a variety of');
 expect(r.quiz).not.toMatch(/variety/i);expect(r.answer).toContain('variety');
});
it('篇章板块不能引用其他段落的句子',async()=>{
 const p=demoProject(),a=p.passages[0];a.paragraphs=[{id:'b1',text:'Students opened a school garden.'},{id:'b2',text:'The garden provides vegetables for lunch.'}];
 const raw={structure:{genre:'记叙文',theme:'校园菜园',outline:[{paragraph:1,endParagraph:1,role:'开端',summary:'学生开辟菜园',relation:'引入',evidenceCitationIds:['C2']},{paragraph:2,endParagraph:2,role:'结果',summary:'提供蔬菜',relation:'承接前段说明作用',evidenceCitationIds:['C2']}],logic:'事件到作用',examFocus:'第21题定位细节',questionLinks:[{questionId:p.questions[0].id,citationIds:['C1'],focus:'细节',method:'找到开辟菜园的对象'}]}};
 vi.stubGlobal('fetch',vi.fn(async()=>response(raw)));
 await expect(generateTeachingPart(p,a.id,'structure',[p.questions[0].id],settings,'test',new AbortController().signal)).rejects.toThrow(/板块.*证据|证据.*范围/);
});
it('同类题通过格式校验后，内容复核不通过仍不能保存',async()=>{
 const e=demoExercise();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({items:[{id:'q',exercise:e}]})).mockResolvedValueOnce(response({issues:[{location:'answer',problem:'B和C均可由材料推出，答案不唯一',suggestion:'改写B，使其成为有依据可排除的干扰项'}]})));
 await expect(generateIndependentExercises([{id:'q',blueprint:{kind:e.kind,skill:e.skill,sourceTopic:e.sourceTopic}}],settings,'test',new AbortController().signal,[])).rejects.toThrow(/复核.*不唯一/);
});
it('词汇原文形态支持屈折变化，并保留教学字段和软件生成的回忆题',async()=>{
 const p=demoProject(),a=p.passages[0];a.paragraphs=[{id:'b',text:'Students observed birds in the garden.'}];
 const raw={lexicon:[{term:'observe',sourceForm:'observed',partOfSpeech:'v.',meaning:'观察',sourceCitationId:'C1',collocations:'observe birds 观察鸟类',contrast:'observe 强调仔细观察；notice 强调注意到。',usageNote:'原文 observed 为过去式，后接 birds 作宾语。',memoryExample:'We observe birds every morning.',exampleTranslation:'我们每天早晨观察鸟类。'}]};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(raw)).mockResolvedValueOnce(response(cleanReview)));
 const result=await generateTeachingPart(p,a.id,'lexicon',[p.questions[0].id],settings,'test',new AbortController().signal),w=result.passages[0].learning!.versions.at(-1)!.data.lexicon[0] as any;
 expect(w.sourceForm).toBe('observed');expect(w.partOfSpeech).toBe('v.');expect(w.usageNote).toContain('过去式');expect(w.quiz).toContain('Students [1] birds');expect(w.quiz).not.toContain('observed');
 const loaded=projectSchema.parse(result);expect(loaded.passages[0].learning!.versions.at(-1)!.data.lexicon[0].exampleTranslation).toBe('我们每天早晨观察鸟类。');
 expect(buildDeck(loaded,undefined,true).filter(s=>s.title.startsWith('词句记忆 · observe')).flatMap(s=>s.body).join('')).toContain('原文 observed 为过去式');
});

it('词条原文形态只能匹配完整词，不能用observe匹配observed',()=>{
 const raw=lexiconGenerationSchema.parse((demoGeneratedPart('lexicon') as any).lexicon);raw[0].sourceForm='observe';
 expect(()=>bindLexicon(raw,createCitationCatalog([{id:'b',text:'Students observed birds.'}]))).toThrow(/原文形态/);
});
it('拒绝大小写不同但实际重复的词条',()=>{
 const p=demoProject(),raw=lexiconGenerationSchema.parse((demoGeneratedPart('lexicon') as any).lexicon);raw.push({...raw[0],term:' VARIETY '});
 expect(()=>bindLexicon(raw,createCitationCatalog(p.passages[0].paragraphs))).toThrow(/重复词条/);
});
it('篇章解题方法只绑定本次真实题号，并能保存重载及放映',async()=>{
 const p=demoProject(),a=p.passages[0],q=p.questions[0],raw=demoGeneratedPart('structure',[q]);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(raw)).mockResolvedValueOnce(response(cleanReview)));
 const result=await generateTeachingPart(p,a.id,'structure',[q.id],settings,'test',new AbortController().signal);
 const loaded=projectSchema.parse(result),d=loaded.passages[0].learning!.versions.at(-1)!.data.structure;
 expect(d.outline[0].evidence?.[0].quote).toContain('Great Smoky Mountains');expect(d.questionLinks?.[0].questionNumber).toBe('21');
 expect(buildDeck(loaded,undefined,true).filter(s=>s.title.startsWith('文章结构')).flatMap(s=>s.body).join('')).toContain('定位依据：');
 const invalid=structuredClone(raw);invalid.structure!.questionLinks[0].questionId='missing-question';
 expect(()=>bindStructure(structureGenerationSchema.parse(invalid.structure),createCitationCatalog(a.paragraphs),a.paragraphs,[q])).toThrow(/未知/);
});
it('内容复核服务认证失败时立即暂停，不重生成或覆盖历史',async()=>{
 const p=demoProject(),before=JSON.stringify(p),raw=demoGeneratedPart('lexicon'),fetch=vi.fn().mockResolvedValueOnce(response(raw)).mockResolvedValueOnce(Response.json({error:{code:'invalid_api_key'}},{status:401}));vi.stubGlobal('fetch',fetch);
 await expect(generateTeachingPart(p,p.passages[0].id,'lexicon',[p.questions[0].id],settings,'test',new AbortController().signal)).rejects.toThrow(/401/);
 expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.stringify(p)).toBe(before);
});
it('复核未通过时只修正一次，并把具体问题及候选交给修正请求',async()=>{
 const p=demoProject(),raw=demoGeneratedPart('lexicon'),prompts:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const text=JSON.parse(init.body).messages[1].content;prompts.push(text);return response(text.startsWith('教学内容复核：')?{issues:[{location:'lexicon[0].meaning',problem:'本篇义与实际语境不符',suggestion:'改为“多样性”'}]}:raw);}));
 await expect(generateTeachingPart(p,p.passages[0].id,'lexicon',[p.questions[0].id],settings,'test',new AbortController().signal)).rejects.toThrow(/复核/);
 expect(prompts).toHaveLength(4);expect(prompts[2]).toContain('本篇义与实际语境不符');expect(prompts[2]).toContain('上次待修正候选');
});
it('复核阶段取消后不会保存候选',async()=>{
 const p=demoProject(),before=JSON.stringify(p),controller=new AbortController(),raw=demoGeneratedPart('lexicon');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(raw)).mockImplementationOnce(async()=>{controller.abort();return response(cleanReview);}));
 await expect(generateTeachingPart(p,p.passages[0].id,'lexicon',[p.questions[0].id],settings,'test',controller.signal)).rejects.toThrow(/取消/);expect(JSON.stringify(p)).toBe(before);
});
it('重新生成其他模块时保留词汇回忆草稿',()=>{
 let p=demoProject();const a=p.passages[0],old=a.learning!.activeVersion;a.learning!.drafts={[old+'lexicon0']:'variety'};
 p=commitTeachingModule(p,a.id,'structure',a.learning!.versions[0].data.structure);
 const l=p.passages[0].learning!;expect(l.drafts?.[l.activeVersion+'lexicon0']).toBe('variety');
});
it('未知程序异常保留原始类型，不伪装成教学内容错误再调用一次API',async()=>{
 const p=demoProject(),failure=new TypeError('unexpected adapter failure'),fetch=vi.fn(async()=>({ok:true,json:async()=>{throw failure;}}));vi.stubGlobal('fetch',fetch);
 await expect(generateTeachingPart(p,p.passages[0].id,'lexicon',[p.questions[0].id],settings,'test',new AbortController().signal)).rejects.toBe(failure);
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('新题生成器不把未知异常包装成无类型的普通Error',async()=>{
 const e=demoExercise(),failure=new TypeError('unexpected adapter failure');vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>{throw failure;}})));
 await expect(generateIndependentExercises([{id:'q',blueprint:{kind:e.kind,skill:e.skill,sourceTopic:e.sourceTopic}}],settings,'test',new AbortController().signal,[])).rejects.toBe(failure);
});
it('界面保留具体内容错误，同时去掉内部异常类型前缀',()=>{
 expect(friendlyError(new GenerationContentError('篇章证据越界，请修正'))).toBe('篇章证据越界，请修正');
});
