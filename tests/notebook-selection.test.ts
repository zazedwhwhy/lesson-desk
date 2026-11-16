import {it,expect} from 'vitest';
import {notebookSelectionRef} from '../src/ui/notebook-selection';
// Ancestors have independently owned attributes, as in chemistry/chinese views.
const node=(values:Record<string,string>)=>({closest:(selector:string)=>{
 const name=selector.match(/^\[data-source-(.+)\]$/)?.[1];
 return name&&values[name]?{getAttribute:()=>values[name]}:null;
}} as unknown as Element);
it('化学原文栏也携带题号来源，讲义版本与题目可来自不同祖先',()=>{
 expect(notebookSelectionRef(node({question:'chem-q'}))).toEqual({questionId:'chem-q'});
 expect(notebookSelectionRef(node({question:'q',group:'g',version:'v',module:'analysis'}))).toEqual({questionId:'q',groupId:'g',versionId:'v',module:'analysis'});
});
it('未定位的正文不伪造题目或材料来源',()=>{expect(notebookSelectionRef(node({}))).toEqual({});});
