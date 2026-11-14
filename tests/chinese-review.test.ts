import {expect,it} from 'vitest';
import {chineseSchema} from '../src/core/chinese';
import {applyChineseReviewBatch,chineseQuestionIssues,splitChineseQuestion,mergeChineseQuestion} from '../src/core/chinese-review';
import {chineseReviewScope} from '../src/ui/preparation-state';
const sample=()=>chineseSchema.parse({groups:[{id:'g',title:'阅读',section:'一',kind:'information',materials:[],questions:[{id:'a',number:'1',stem:'分析',format:'short',materialIds:[],confirmed:true},{id:'b',number:'2',stem:'说明',format:'short',materialIds:[],confirmed:false},{id:'c',number:'3',stem:'概括',format:'short',materialIds:[],confirmed:true,excluded:true}]}]});
it('语文未勾选按整卷已核对题目生成；勾选后仅使用勾选范围',()=>{
 const d=sample();expect(chineseReviewScope(d,[])).toMatchObject({questionIds:['a'],groupIds:['g'],unconfirmed:1,excluded:1});
 expect(chineseReviewScope(d,['b'])).toMatchObject({questionIds:[],groupIds:[],unconfirmed:1});
 expect(chineseReviewScope(d,['c'])).toMatchObject({questionIds:[],groupIds:[],excluded:1});
});
it('批量确认跳过缺失关联，原数据不变，恢复已启用题不撤销核对',()=>{
 const d=sample();d.groups[0].questions[1].materialIds=['missing'];
 const result=applyChineseReviewBatch(d,['b'],'confirm');expect(result.changed).toBe(0);expect(result.skipped.join()).toMatch(/关联/);expect(d.groups[0].questions[1].confirmed).toBe(false);
 const restored=applyChineseReviewBatch(d,['a','c'],'restore');expect(restored.changed).toBe(1);expect(restored.data.groups[0].questions[0].confirmed).toBe(true);expect(restored.data.groups[0].questions[2]).toMatchObject({excluded:false,confirmed:false});
});
it('所选题目已不存在应明确报错',()=>{expect(()=>applyChineseReviewBatch(sample(),['missing'],'confirm')).toThrow(/变化/);});
it('逐题与批量核对使用相同的缺失关联和未核对图片规则',()=>{
 const d=sample(),q=d.groups[0].questions[0];q.materialIds=['missing'];expect(chineseQuestionIssues(d,q).join()).toContain('关联');
 d.groups[0].materials.push({id:'missing',title:'图',text:'',sourceId:'',blockIds:[],image:'data:image/png;base64,AAAA',imageConfirmed:false});expect(chineseQuestionIssues(d,q).join()).toContain('图片');
 expect(applyChineseReviewBatch(d,['a'],'confirm').skipped).toHaveLength(1);
});
it('拆题保留关联和旧版本，新题重新核对；合题合并关联并撤销确认',()=>{
 const d=sample(),g=d.groups[0];g.questions[0].materialIds=['m1'];g.questions[0].answer='答案一';g.questions[0].answerSource='provided';
 splitChineseQuestion(d,'g','a','new');expect(g.questions[1]).toMatchObject({id:'new',number:'1b',materialIds:['m1'],answer:'',confirmed:false,answerSource:'none'});
 g.questions[1].materialIds=['m2'];g.questions[1].stem='另一小问';g.questions[1].answer='答案二';
 mergeChineseQuestion(d,'g','a');expect(g.questions[0]).toMatchObject({materialIds:['m1','m2'],confirmed:false,answer:'答案一；答案二'});expect(g.questions[0].stem).toContain('另一小问');expect(g.questions.some(q=>q.id==='new')).toBe(false);
 expect(()=>mergeChineseQuestion(d,'g','c')).toThrow(/下一题/);
});
