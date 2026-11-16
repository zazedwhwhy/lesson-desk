import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {emptyProject} from '../src/core/model';
import {protectChemistry} from '../src/core/source-fidelity';
import {SourceMaterials} from '../src/ui/SourceMaterials';

it('考生注意与试题同号时，化学保真检查应绑定真实题面',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'卷',kind:'pdf',role:'paper',blocks:[{id:'r1',page:1,text:'1．答题前，请填写姓名。'},{id:'r2',page:1,text:'2．非选择题的答案必须写在答题纸上。'},{id:'h',page:1,text:'一、选择题'},{id:'q1',page:1,text:'1．下列属于极性分子的是\nA．HCl\nB．N₂'},{id:'q2',page:1,text:'2．下列属于单质的是\nA．O₂\nB．H₂O'}]}];
 const issues:NonNullable<typeof p.sourceFidelityIssues>=[];protectChemistry(p,{questions:[{number:'1',sourceId:'s',stem:'下列属于极性分子的是',options:['A．HCl','B．N₂'],answer:''}]},issues);
 expect(issues).toEqual([]);
});
it('跨页题面不把重复页眉页脚当作遗漏，真正的追问仍须报告',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'卷',kind:'pdf',role:'paper',blocks:[{id:'header1',page:1,y:810,text:'2025年化学试题与答案 [示例]'},{id:'q',page:1,y:100,text:'17．气体a为___。'},{id:'footer',page:1,y:50,text:'化学（选考）试题 第1页（共8页）'},{id:'header2',page:2,y:810,text:'2025年化学试题与答案 [示例]'},{id:'tail',page:2,y:700,text:'解释原因___。'},{id:'next',page:2,y:600,text:'18．其他问题'}]}];
 const q={number:'17',sourceId:'s',stem:'气体a为___。解释原因___。',options:[],answer:''},issues:NonNullable<typeof p.sourceFidelityIssues>=[];
 protectChemistry(p,{questions:[q]},issues);expect(issues).toEqual([]);
 const missing:typeof issues=[];protectChemistry(p,{questions:[{...q,stem:'气体a为___。'}]},missing);expect(missing.some(i=>i.location.includes('全部作答要求'))).toBe(true);
});
it('有文字层的PDF也应有按原页重新识别入口',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'卷',kind:'pdf',role:'paper',asset:'sources/s.pdf',ocrPages:[],blocks:[{id:'b',page:1,text:'可提取文字但结构式需核对'}]}];
 const html=renderToStaticMarkup(<SourceMaterials project={p} busy={false} paste="" setPaste={()=>{}} sourceId="s" setSourceId={()=>{}} change={async()=>{}} run={async fn=>fn()} task={async()=>{}}/>);
 expect(html).toContain('按原页重新识别');
});
it('非选择题子问的选项已在题干时，不将重复展示误判成原题不完整',()=>{
 const p=emptyProject('化学','chemistry'),stem='（1）选择正确的说法。\nA．选项甲\nB．选项乙\n（2）解释原因___。';p.sources=[{id:'s',name:'卷',kind:'text',role:'paper',blocks:[{id:'b',text:'17．'+stem}]}];
 const issues:NonNullable<typeof p.sourceFidelityIssues>=[];protectChemistry(p,{questions:[{number:'17',sourceId:'s',stem,options:['A．选项甲','B．选项乙'],answer:''}]},issues);expect(issues).toEqual([]);
});
