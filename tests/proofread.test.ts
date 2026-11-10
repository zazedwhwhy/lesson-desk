import { expect, it, vi, afterEach } from 'vitest';
import { demoProject } from '../src/core/demo';
import { checkIntegrity, proofreadFingerprint, validateProofreadResult, createProofreadRequest } from '../src/core/proofread';
import { proofreadProject } from '../src/desktop/proofread';

function fixture() {
  const p = demoProject(); p.questions[0].number = '41'; p.questions[0].type = 'cloze';
  p.passages[0].type = 'cloze'; p.passages[0].paragraphs[0].text = 'A ___41___ and a ___43___.';
  p.questions[0].options = ['one', 'two', 'three', 'four'];
  p.questions.push({ ...structuredClone(p.questions[0]), id: 'q43', number: '43', answer: '' });
  p.sources = [{ id:'paper', name:'试卷', role:'paper', kind:'text', blocks:[{id:'source41', text:'41. Choose the answer.'},{id:'source42',text:'42. Another question.'}] }];
  return p;
}
const clean = (p: ReturnType<typeof fixture>) => ({ coverage:'complete' as const, checkedQuestionIds:p.questions.map(q=>q.id), checkedSourceIds:p.sources.map(s=>s.id), limitations:[], findings:[] });
afterEach(()=>vi.unstubAllGlobals());
it('发现题号缺口、源材料漏题与缺答案，并且不修改试卷', () => {
  const p=fixture(), before=structuredClone(p), result=checkIntegrity(p);
  expect(result.some(i=>i.code==='number_gap')).toBe(true);
  expect(result.some(i=>i.code==='source_question_missing'&&i.sourceId==='paper')).toBe(true);
  expect(result.some(i=>i.code==='missing_answer'&&i.questionId==='q43')).toBe(true);
  expect(p).toEqual(before);
});
it('排除题仍计入题号连续性，写作重新编号不与阅读混淆', () => {
  const p=fixture(); p.questions.push({...structuredClone(p.questions[0]),id:'q42',number:'42',excluded:true});
  p.questions.push({...structuredClone(p.questions[0]),id:'w1',number:'1',type:'writing'});
  expect(checkIntegrity(p).filter(i=>i.code==='number_gap')).toEqual([]);
});
it('检查选项、同组重复题号和填空错位', () => {
  const p=fixture(); p.questions[0].options=[];p.questions[1].number='41';
  const codes=checkIntegrity(p).map(i=>i.code);
  expect(codes).toContain('missing_options');expect(codes).toContain('duplicate_number');expect(codes).toContain('blank_unmatched');
});
it('内容快照随原文/答案/解析变化而变化，单纯核对状态不会使报告失效', () => {
  const p=fixture(), original=proofreadFingerprint(p,true);p.questions[0].confirmed=!p.questions[0].confirmed;
  expect(proofreadFingerprint(p,true)).toBe(original);p.questions[0].answer='B';expect(proofreadFingerprint(p,true)).not.toBe(original);
  const noExplanation=proofreadFingerprint(p,false);p.questions[0].versions[0].analysis='改过';
  expect(proofreadFingerprint(p,false)).toBe(noExplanation);
});
it('禁止缺少覆盖范围却报告整卷完成，以及伪造题目ID或来源证据', () => {
  const p=fixture(), report=clean(p);report.checkedQuestionIds=[];
  expect(()=>validateProofreadResult(p,report)).toThrow('覆盖');
  expect(()=>validateProofreadResult(p,{...clean(p),checkedQuestionIds:['fake']})).toThrow();
  expect(()=>validateProofreadResult(p,{...clean(p),findings:[{category:'answer_mismatch',severity:'warning',questionIds:[p.questions[0].id],passageIds:[],description:'答案错位',suggestion:'核查',evidence:[{sourceId:'paper',blockId:'source41',quote:'made up'}]}]})).toThrow('引用');
});
it('实际接口请求包含原始来源；校对只添加报告，保留原题、答案和确认状态', async () => {
  const p=fixture(), before=structuredClone(p);let sent='';
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{sent=String(init.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...clean(p),checkedQuestionIds:['Q1','Q2'],checkedSourceIds:['S1']})}}]});}));
  const result=await proofreadProject(p,{provider:'deepseek',model:'test',baseUrl:'https://api.deepseek.com'},'test-key',true,new AbortController().signal);
  expect(sent).toContain('Another question.');expect(result.proofread?.result.coverage).toBe('complete');
  expect(result.questions).toEqual(before.questions);expect(p).toEqual(before);
});
it('API失败不替换已有报告，也不自动切换或生成通过状态', async () => {
  const p=fixture(), before=structuredClone(p);const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:401}));vi.stubGlobal('fetch',fetch);
  await expect(proofreadProject(p,{provider:'deepseek',model:'test',baseUrl:'https://api.deepseek.com'},'bad',false,new AbortController().signal)).rejects.toThrow('401');
  expect(p).toEqual(before);expect(fetch).toHaveBeenCalledTimes(1);
});
it('过大材料及已取消任务不发起API请求', async () => {
  const p=fixture(), fetch=vi.fn();vi.stubGlobal('fetch',fetch);p.sources[0].blocks[0].text='x'.repeat(160001);
  const s={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
  await expect(proofreadProject(p,s,'key',false,new AbortController().signal)).rejects.toThrow('16万');
  const c=new AbortController();c.abort();await expect(proofreadProject(fixture(),s,'key',false,c.signal)).rejects.toThrow('取消');
  expect(fetch).not.toHaveBeenCalled();
});
it('短编号请求严格映射回稳定ID，不按题号猜测身份',()=>{
  const p=fixture(),request=createProofreadRequest(p,true);
  expect(request.input.questions.map(q=>q.id)).toEqual(['Q1','Q2']);
  expect(request.input.sources[0].blocks[0].id).toBe('S1B1');
  const result=request.decode({...clean(p),checkedQuestionIds:['Q1','Q2'],checkedSourceIds:['S1'],findings:[{category:'other',severity:'warning',questionIds:['Q1'],passageIds:['P1'],description:'核查',suggestion:'对照原卷',evidence:[{sourceId:'S1',blockId:'S1B1',quote:'41. Choose'}]}]});
  expect(result.checkedQuestionIds).toEqual(p.questions.map(q=>q.id));expect(result.findings[0].evidence[0]).toMatchObject({sourceId:'paper',blockId:'source41'});
  expect(()=>request.decode({...clean(p),checkedQuestionIds:['41'],checkedSourceIds:['S1']})).toThrow('未知');
});
it('直接比对明确的答案范围，拒绝将一致的答案误报为错配',()=>{
  const p=fixture();p.sources.push({id:'key',role:'answer',name:'答案',kind:'text',blocks:[{id:'range',text:'41-43 ACB'}]});
  const same={...clean(p),findings:[{category:'answer_mismatch',severity:'error',questionIds:[p.questions[0].id],passageIds:[],description:'待核查答案',suggestion:'核查',evidence:[]}]};
  expect(()=>validateProofreadResult(p,same)).toThrow('答案一致');
  p.questions[0].answer='D';expect(checkIntegrity(p).some(i=>i.code==='source_answer_mismatch')).toBe(true);
});
it('高中听力三选项正常，不能按阅读四选项误报',()=>{
  const p=fixture();p.questions=p.questions.slice(0,1);const q=p.questions[0];q.type='listening';q.options=['one','two','three'];q.answer='B';
  expect(checkIntegrity(p).filter(i=>i.questionId===q.id&&['missing_options','answer_format'].includes(i.code))).toEqual([]);
  q.answer='D';expect(checkIntegrity(p).some(i=>i.code==='answer_format')).toBe(true);
});
