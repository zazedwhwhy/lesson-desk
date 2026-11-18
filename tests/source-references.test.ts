import{it,expect}from'vitest';import{demoProject}from'../src/core/demo';import{attachSourceReferences}from'../src/core/source-references';
it('从答案册关联明确听力稿',()=>{const p=demoProject();p.passages[0].type='listening';p.passages[0].paragraphs=[];p.sources=[{id:'answer',kind:'text',role:'answer',name:'答案',blocks:[{id:'b1',text:'(Text 1)\nM: Hello.'},{id:'b10',text:'Text 10 Final recording'},{id:'b2',text:'英语 第6页（共6页）答案'}]}];attachSourceReferences(p);expect(p.passages[0].paragraphs.map(b=>b.text)).toEqual(['(Text 1)\nM: Hello.','Text 10 Final recording']);});
it('范文与题干分开且不自动确认题目',()=>{const p=demoProject();p.questions[0].type='writing';p.questions[0].confirmed=false;p.questions[0].stem='请写一封信。参考示例：Dear X';p.sources=[{id:'a',kind:'text',role:'answer',name:'答案',blocks:[{id:'a1',text:'第一节：应用文（满分15分）'},{id:'a2',text:'One possible version:'},{id:'a3',text:'Dear Peter, Thank you.'},{id:'a4',text:'第二节：读后续写'}]}];attachSourceReferences(p);expect(p.questions[0].stem).toBe('请写一封信。');expect(p.questions[0].answer).toContain('Dear Peter');expect(p.questions[0].confirmed).toBe(false);});
it('无明确范文时不编造参考答案',()=>{const p=demoProject();p.questions[0].type='writing';p.questions[0].answer='';attachSourceReferences(p);expect(p.questions[0].answer).toBe('');});

it('两份答案册有同类原文时保留教师内容并提示对应关系',()=>{
 const p=demoProject();p.passages[0].type='listening';p.questions[0].type='writing';
 p.sources=['甲卷','乙卷'].map(id=>({id,name:id,role:'answer',kind:'text',blocks:[
  {id:'speech',text:'Text 1 '+id},{id:'heading',text:'第一节 应用文'},{id:'sample',text:'One possible version: '+id}]}));
 const before=structuredClone(p);attachSourceReferences(p);
 expect(p.questions[0].answer).toBe(before.questions[0].answer);
 expect(p.passages[0].paragraphs).toEqual(before.passages[0].paragraphs);expect(p.sourceFidelityIssues).toHaveLength(2);
});
