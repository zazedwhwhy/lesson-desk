import {it,expect} from 'vitest';
import {preparationProgress,chinesePreparationScope} from '../src/ui/preparation-state';
import {chineseSchema} from '../src/core/chinese';

it('取消、服务暂停、失败和中断不冒充生成完成，保留真实已保存数',()=>{
 const tasks=[{state:'complete' as const},{state:'failed' as const},{state:'pending' as const}];
 expect(preparationProgress(tasks,{state:'cancelled'})).toMatchObject({state:'已取消',complete:1,failed:1,pending:1,unfinished:2});
 expect(preparationProgress(tasks,{state:'partial',stopReason:'API key invalid'}).state).toBe('服务已暂停');
 expect(preparationProgress(tasks,{state:'complete'}).state).toBe('部分完成，有失败项');
 expect(preparationProgress([{state:'failed'}]).state).toBe('生成失败');
 expect(preparationProgress([{state:'running'}],{state:'running'}).state).toBe('上次任务已中断');
 expect(preparationProgress(tasks,{state:'running'},true,true).state).toBe('正在取消');
});
it('空任务不算成功；全部保存不等于教师确认',()=>{
 expect(preparationProgress([],{state:'complete'}).state).toBe('尚未生成');
 expect(preparationProgress([{state:'complete'}]).state).toBe('已全部保存，待核对');
});
it('语文范围只计所选组、非排除题与适用模块；空题目选择不扩成全卷',()=>{
 const d=chineseSchema.parse({groups:[{id:'g',section:'阅读',title:'合成材料',kind:'information',materials:[],questions:[{id:'q1',number:'1',stem:'合成问题',format:'short',materialIds:[],confirmed:true},{id:'q2',number:'2',stem:'合成问题',format:'short',materialIds:[],confirmed:false},{id:'q3',number:'3',stem:'合成问题',format:'short',materialIds:[],confirmed:true,excluded:true}]},{id:'other',section:'阅读',title:'未选材料',kind:'information',materials:[],questions:[{id:'q4',number:'4',stem:'合成问题',format:'short',materialIds:[]}]}]});
 expect(chinesePreparationScope(d,['g'],['analysis','structure','translation'],['q1','q2','q3','q4'])).toMatchObject({taskCount:3,unconfirmed:1});
 expect(chinesePreparationScope(d,['g'],['analysis'],[])).toMatchObject({taskCount:0,questions:[]});
 expect(chinesePreparationScope(d,['g'],['structure'],[])).toMatchObject({taskCount:1,questions:[]});
 expect(chinesePreparationScope(d,[],['analysis'],['q1']).taskCount).toBe(0);
});
