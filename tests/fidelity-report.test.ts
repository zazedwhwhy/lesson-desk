import {expect,it} from 'vitest';
import {emptyProject,projectSchema} from '../src/core/model';
import {protectEnglish} from '../src/core/source-fidelity';
it('第66题不一致时记录差异，保留候选并继续检查后续题目，报告可持久化',()=>{
 const p=emptyProject('合成卷');p.sources=[{id:'s',name:'卷',kind:'text',role:'paper',blocks:[{id:'b',text:'66. Original\n67. Next'}]}];
 const out={passages:[],questions:[{number:'66',stem:'Changed',options:[],answer:'',type:'reading',passageId:'a'},{number:'67',stem:'Also changed',options:[],answer:'',type:'reading',passageId:'a'}]};
 const report:NonNullable<typeof p.sourceFidelityIssues>=[];
 protectEnglish(p,out,report);
 expect(report.map(x=>x.location)).toEqual(['第66题题干','第67题题干']);
 expect(report[0]).toMatchObject({expected:'Original',received:'Changed'});
 expect(out.questions).toHaveLength(2);
 expect(projectSchema.parse({...p,sourceFidelityIssues:report}).sourceFidelityIssues).toEqual(report);
});
