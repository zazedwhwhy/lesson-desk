import {afterEach,expect,it,vi} from 'vitest';
import {emptyProject} from '../src/core/model';
import {chemQuestionSchema} from '../src/core/chemistry';
import {refreshChemistryFidelity,chemistryReviewSnapshot} from '../src/core/chemistry-review';
import {reviewChemistry} from '../src/desktop/chemistry-review';
const settings={provider:'custom' as const,model:'test',baseUrl:'https://example.test'};
afterEach(()=>vi.unstubAllGlobals());
function project(){const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'卷',role:'paper',kind:'pdf',blocks:[{id:'b',page:1,text:'1．气体a为___。解释原因___。'}]}];p.chemistry!.questions=[chemQuestionSchema.parse({id:'q1',number:'1',sourceId:'s',pages:[1],stem:'气体a为___。解释原因___。',answer:'教师已修改的参考答案',confirmed:true,versions:[{id:'v',createdAt:'before',origin:'teacher',module:'analysis',fingerprint:'saved',confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'讲评',text:'保留讲评'}]}}]})];return p;}
it('本地重新检查只更新报告，不规范化或替换教师题面/答案',()=>{
 const p=project(),before=structuredClone(p);p.sourceFidelityIssues=[{location:'旧误报',expected:'注意事项',received:'试题'}];
 const out=refreshChemistryFidelity(p);expect(out.chemistry).toEqual(before.chemistry);expect(out.sourceFidelityIssues?.some(i=>i.location==='旧误报')).toBe(false);expect(p.sourceFidelityIssues[0].location).toBe('旧误报');
});
it('化学AI校对按3题分批，文字结果不能冒充图示已核验',async()=>{
 const p=project();p.chemistry!.questions=Array.from({length:4},(_,i)=>({...structuredClone(p.chemistry!.questions[0]),id:'q'+(i+1),number:String(i+1),versions:[]}));const before=structuredClone(p);
 const fetch=vi.fn(async(_url,init)=>{const prompt=JSON.parse(String(init.body)).messages.at(-1).content;const input=JSON.parse(prompt.split('输入材料：')[1].split('\n')[0]);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({coverage:'complete',checkedQuestionIds:input.questions.map((q:any)=>q.id),limitations:[],findings:[]})}}]});});vi.stubGlobal('fetch',fetch);
 const out=await reviewChemistry(p,settings,'synthetic',new AbortController().signal);expect(fetch).toHaveBeenCalledTimes(2);expect(out.chemistry!.review?.result.coverage).toBe('partial');expect(out.chemistry!.review?.result.checkedQuestionIds).toHaveLength(4);expect(out.chemistry!.questions).toEqual(before.chemistry!.questions);expect(p).toEqual(before);
 const saved=out.chemistry!.review!.snapshot;out.chemistry!.questions[0].stem+='编辑';expect(chemistryReviewSnapshot(out)).not.toBe(saved);
});
it('AI校对漏题或返回无关题目时保留旧报告',async()=>{
 const p=project();p.chemistry!.review={snapshot:'old',result:{coverage:'partial',checkedQuestionIds:[],limitations:['旧记录'],findings:[]}};const before=structuredClone(p);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({coverage:'complete',checkedQuestionIds:[],limitations:[],findings:[]})}}]})));
 await expect(reviewChemistry(p,settings,'synthetic',new AbortController().signal)).rejects.toThrow(/遗漏/);expect(p).toEqual(before);
});
