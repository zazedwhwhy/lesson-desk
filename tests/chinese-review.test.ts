import {expect,it} from 'vitest';
import {chineseSchema} from '../src/core/chinese';
import {applyChineseReviewBatch} from '../src/core/chinese-review';
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
