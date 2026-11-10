import { expect, it } from 'vitest';
import { demoProject } from '../src/core/demo';
import { applyCorrections, undoCorrection, createCorrectionRequest } from '../src/core/correction';
import{demoExercise}from'../src/core/exercise-demo';import{exerciseText,exerciseAnswerText}from'../src/core/exercise';

function fixture(){const p=demoProject();const q=p.questions[0];q.number='41';q.answer='B';p.sources=[{id:'paper',name:'试卷',role:'paper',kind:'text',blocks:[{id:'s1',text:'41. Which park is famous for its biodiversity?\nA. Great Smoky Mountains. B. Yosemite.'}]},{id:'key',name:'答案',role:'answer',kind:'text',blocks:[{id:'k1',text:'41-43 ACB'}]}];return p;}
const refs=[{sourceId:'key',blockId:'k1',quote:'41-43 ACB'}];
const settings={provider:'deepseek',model:'test'};
function answerPatch(p:ReturnType<typeof fixture>){return {kind:'question',questionId:p.questions[0].id,field:'answer',before:'B',after:'A',reason:'对照答案来源修正错配',evidence:refs};}
it('有明确答案依据才能自动修正，取消核对、保留历史，原文件不变并可撤销',()=>{
  const p=fixture(),before=structuredClone(p),next=applyCorrections(p,{operations:[answerPatch(p)],unresolved:[]},settings,false);
  expect(next.questions[0]).toMatchObject({answer:'A',confirmed:false,stale:true});expect(next.questions[0].versions).toEqual(p.questions[0].versions);
  expect(next.sources).toEqual(p.sources);expect(p).toEqual(before);expect(next.corrections?.at(-1)?.changes).toHaveLength(1);
  const restored=undoCorrection(next);expect(restored.questions).toEqual(p.questions);expect(restored.passages).toEqual(p.passages);expect(restored.corrections?.at(-1)?.undoneAt).toBeTruthy();
});
it('拒绝无依据答案、错误旧值和伪造证据，整批不落入原项目',()=>{
  const p=fixture(),before=structuredClone(p),patch=answerPatch(p);
  expect(()=>applyCorrections(p,{operations:[{...patch,after:'D'}],unresolved:[]},settings,false)).toThrow('答案');
  expect(()=>applyCorrections(p,{operations:[{...patch,before:'C'}],unresolved:[]},settings,false)).toThrow('旧值');
  expect(()=>applyCorrections(p,{operations:[patch,{...patch,field:'stem',before:p.questions[0].stem,after:'fake',evidence:[{sourceId:'paper',blockId:'s1',quote:'fake'}]}],unresolved:[]},settings,false)).toThrow();
  expect(p).toEqual(before);
});
it('自动修正后教师又编辑时，撤销不会覆盖教师的新内容',()=>{
  const p=fixture(),next=applyCorrections(p,{operations:[answerPatch(p)],unresolved:[]},settings,false);
  next.questions[0].stem='教师新写的题干';expect(()=>undoCorrection(next)).toThrow('继续修改');
});
it('短编号补丁严格映射回题目与来源，不猜编号、不修改输入',()=>{
  const p=fixture(),before=structuredClone(p),r=createCorrectionRequest(p,false);
  const plan=r.decode({operations:[{...answerPatch(p),questionId:'Q1',evidence:[{sourceId:'S2',blockId:'S2B1',quote:'41-43 ACB'}]}],unresolved:[]});
  expect(plan.operations[0]).toMatchObject({questionId:p.questions[0].id});expect(p).toEqual(before);
  expect(()=>r.decode({operations:[{...answerPatch(p),questionId:'41'}],unresolved:[]})).toThrow();
});
it('无可执行修改时明确保留待处理问题，不创建假修改',()=>{
  const p=fixture(),next=applyCorrections(p,{operations:[],unresolved:['题目关联不清，需要老师核对原卷']},settings,false);
  expect(next.questions).toEqual(p.questions);expect(next.corrections?.at(-1)?.changes).toEqual([]);expect(next.corrections?.at(-1)?.unresolved).toHaveLength(1);
});
it('补入来源明确的漏题，ID由软件生成且保持未核对',()=>{
  const p=fixture(),source={sourceId:'paper',blockId:'s42',quote:'42. A second question? A. Alpha B. Beta C. Gamma D. Delta'};p.sources[0].blocks.push({id:source.blockId,text:source.quote});
  const next=applyCorrections(p,{operations:[{kind:'add_question',passageId:p.passages[0].id,number:'42',stem:'A second question?',options:['Alpha','Beta','Gamma','Delta'],answer:'C',reason:'补回原卷漏题',evidence:[source,...refs]}],unresolved:[]},settings,false);
  expect(next.questions).toHaveLength(2);expect(next.questions[1]).toMatchObject({number:'42',answer:'C',confirmed:false,versions:[]});expect(next.questions[1].id).not.toBe(p.questions[0].id);
});
it('只能排除完全相同的重复题，保留题目与解析',()=>{
  const p=fixture(),other={...structuredClone(p.questions[0]),id:'duplicate'};p.questions.push(other);
  const op={kind:'exclude_duplicate',questionId:other.id,reason:'完全重复',evidence:[{sourceId:'paper',blockId:'s1',quote:p.sources[0].blocks[0].text}]};
  const next=applyCorrections(p,{operations:[op],unresolved:[]},settings,false);expect(next.questions).toHaveLength(2);expect(next.questions[1]).toMatchObject({excluded:true,confirmed:false});expect(next.questions[1].versions).toEqual(other.versions);
  p.questions[1].stem='另一个题干';expect(()=>applyCorrections(p,{operations:[op],unresolved:[]},settings,false)).toThrow('完全相同');
});
it('修改讲解需要明确选择，保存新版本并保留教师旧版本',()=>{
  const p=fixture(),q=p.questions[0];q.answer='A';q.versions[0].origin='teacher';p.sources[0].blocks.push({id:'article',text:p.passages[0].paragraphs[0].text});
  const exercise=demoExercise(),old=q.versions[0],after={answer:'A',analysis:'修订后的解释：biodiversity对应物种多样性。',evidence:old.evidence,practice:exerciseText(exercise),practiceAnswer:exerciseAnswerText(exercise),exercise};
  const op={kind:'explanation',questionId:q.id,beforeVersion:q.activeVersion,after,reason:'修正术语',evidence:[{sourceId:'paper',blockId:'article',quote:p.sources[0].blocks.at(-1)!.text}]};
  expect(()=>applyCorrections(p,{operations:[op],unresolved:[]},settings,false)).toThrow('未选择');
  const next=applyCorrections(p,{operations:[op],unresolved:[]},settings,true);expect(next.questions[0].versions).toHaveLength(2);expect(next.questions[0].versions[0]).toEqual(old);expect(next.questions[0]).toMatchObject({confirmed:false,stale:false});
});
