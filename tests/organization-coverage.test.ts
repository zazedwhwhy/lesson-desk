import {afterEach,expect,it,vi} from 'vitest';
import {emptyProject,projectSchema,questionSchema,passageSchema,type Project} from '../src/core/model';
import {organize} from '../src/desktop/ai';
import {organizeChemistry} from '../src/desktop/chemistry';
import {organizationScopes,organizationCoverageIssues} from '../src/core/organization-coverage';

const settings={provider:'custom' as const,model:'test',baseUrl:'https://example.test'};
const signal=()=>new AbortController().signal;
afterEach(()=>vi.unstubAllGlobals());
function paper(subject:'english'|'chemistry'){
 const p=emptyProject('合成整卷',subject);
 p.sources=[{id:'s',name:'试卷',kind:'text',role:'paper',blocks:[{id:'m',page:1,text:subject==='english'?'Reading\nA complete passage.':'一、选择题'},{id:'q1',page:1,text:'1. First question?\nA. one\nB. two'},{id:'q2',page:2,text:'2. Second question?\nA. one\nB. two'}]}];
 return p;
}
function candidate(subject:'english'|'chemistry',n:number){
 const q={number:String(n),stem:n===1?'First question?':'Second question?',options:['A. one','B. two'],answer:''};
 return subject==='english'?{passages:[{id:'p',title:'Reading',type:'reading',paragraphs:[{id:'m',text:'A complete passage.'}],pool:''}],questions:[{...q,id:'q',passageId:'p',type:'reading'}]}:{questions:[{...q,kind:'choice',sourceId:'s',pages:[n]}]};
}
function mock(subject:'english'|'chemistry',alwaysFirst=false){let count=0;const fetch=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate(subject,++count===1||alwaysFirst?1:2))}}]}));vi.stubGlobal('fetch',fetch);return fetch;}
const organizeSubject=(p:Project)=>p.subject==='english'?organize(p,settings,'synthetic',signal()):organizeChemistry(p,settings,'synthetic',signal());
it.each(['english','chemistry'] as const)('%s 只返回首题时应自动补齐后续题目',async subject=>{
 const p=paper(subject),before=structuredClone(p);const fetch=mock(subject);
 const out=await organizeSubject(p);
 expect((subject==='english'?out.questions:out.chemistry!.questions).map(q=>q.number)).toEqual(['1','2']);
 expect(fetch.mock.calls.length).toBeGreaterThan(1);expect(p).toEqual(before);
});
it.each(['english','chemistry'] as const)('%s 持续漏题只重试两次，报告遗漏并保留有效题目',async subject=>{
 const p=paper(subject),fetch=mock(subject,true);const out=await organizeSubject(p);
 expect((subject==='english'?out.questions:out.chemistry!.questions).map(q=>q.number)).toEqual(['1']);
 expect(fetch).toHaveBeenCalledTimes(3);expect(out.organizationIssues?.join(' ')).toContain('第 2 题');
 expect(projectSchema.parse(out).organizationIssues).toEqual(out.organizationIssues);
});
it.each(['english','chemistry'] as const)('%s 旧课件补漏保留已有题目、核对状态和教师内容',async subject=>{
 mock(subject,true);const partial=await organizeSubject(paper(subject));
 if(subject==='english'){partial.questions[0].confirmed=true;partial.passages[0].translation='教师译文';partial.questions[0].versions=[{id:'v',createdAt:'before',origin:'teacher',answer:'A',analysis:'教师讲评',evidence:[],practice:'',practiceAnswer:'',conflict:false}];}
 else{partial.chemistry!.questions[0].confirmed=true;partial.chemistry!.questions[0].versions=[{id:'v',createdAt:'before',origin:'teacher',module:'analysis',fingerprint:'teacher',confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'讲评',text:'教师讲评'}]}}];}
 const before=structuredClone(partial);const fetch=vi.fn(async(_url,init)=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate(subject,2))}}]}));vi.stubGlobal('fetch',fetch);
 const out=await (subject==='english'?organize:organizeChemistry)(partial,settings,'synthetic',signal(),{recover:true});
 expect(fetch).toHaveBeenCalledTimes(1);expect(partial).toEqual(before);expect(out.organizationIssues).toEqual([]);
 if(subject==='english'){expect(out.questions[0]).toEqual(before.questions[0]);expect(out.passages[0]).toEqual(before.passages[0]);expect(out.passages).toHaveLength(1);}
 else expect(out.chemistry!.questions[0]).toEqual(before.chemistry!.questions[0]);
 const body=JSON.parse(String(fetch.mock.calls[0][1].body));expect(body.messages.at(-1).content).toContain('只');
});
it.each(['english','chemistry'] as const)('%s 服务中断停止补发，已成功题目可保存且保留报告',async subject=>{
 const p=paper(subject);let count=0;const fetch=vi.fn(async()=>++count===1?Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate(subject,1))}}]}):Response.json({error:{message:'unauthorized'}},{status:401}));vi.stubGlobal('fetch',fetch);
 const out=await organizeSubject(p);expect(fetch).toHaveBeenCalledTimes(2);expect(out.organizationIssues?.join(' ')).toContain('401');expect(out.organizationIssues?.join(' ')).toContain('第 2 题');
});
it.each(['english','chemistry'] as const)('%s 取消后不提交候选结果或修改旧课件',async subject=>{
 const p=paper(subject),before=structuredClone(p),controller=new AbortController();let count=0;
 vi.stubGlobal('fetch',vi.fn(async()=>{if(++count>1)controller.abort();return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate(subject,count===1?1:2))}}]});}));
 await expect((subject==='english'?organize:organizeChemistry)(p,settings,'synthetic',controller.signal)).rejects.toThrow(/取消/);expect(p).toEqual(before);
});
it('英语题号清单包含行内空号、范围及未编号写作，排除答案册题号和说明序号',()=>{
 const p=emptyProject('英语整卷');
 p.sources=[{id:'s',name:'卷',role:'paper',kind:'text',blocks:[{id:'r',text:'1. 请填写姓名。\n2. 请在答题卡作答。'},{id:'h',text:'第二部分 阅读\nQuestions 21-23'},{id:'a',text:'A full passage.\n21. What is true?'},{id:'g',text:'第三部分 语言运用\nThere are __56__ things and 57___ examples.'},{id:'w',text:'第四部分 写作\n第一节（满分15分）\n假定你是李华，请写一封信。\n1. 词数80左右；\n2. 请按如下格式作答。'},{id:'c',text:'第二节 读后续写\n续写两段。'}]},{id:'answer',name:'答案',role:'answer',kind:'text',blocks:[{id:'ans',text:'99. 其他试卷的答案'}]}];
 const targets=organizationScopes(p).flatMap(s=>s.targets);
 expect(targets.filter(t=>t.number).map(t=>t.number)).toEqual(['21','22','23','56','57']);
 expect(targets.filter(t=>t.type).map(t=>t.type)).toEqual(['writing','continuation']);
 expect(organizationCoverageIssues(p).join(' ')).toContain('读后续写');
});
it('化学分段保留跨页续文与全部小问，不把小问标记当作大题',()=>{
 const p=paper('chemistry');p.sources[0].blocks=[{id:'q16',page:1,text:'16. （1）条件\n（2）解释'},{id:'continued',page:2,text:'（3）计算与图示'},{id:'q17',page:2,text:'17. 后一道题'}];
 const scopes=organizationScopes(p);expect(scopes.flatMap(s=>s.targets.map(t=>t.number))).toEqual(['16','17']);expect(scopes[0].source.blocks.map(b=>b.id)).toEqual(expect.arrayContaining(['q16','continued']));
});
it('化学补漏范围必须保留无编号的共同实验条件',()=>{
 const p=paper('chemistry');p.sources[0].blocks=[{id:'context',text:'根据下列实验回答1、2题：装置与必要条件。'},{id:'q1',text:'1. 根据上述实验判断。'},{id:'q2',text:'2. 上述装置的作用。'}];
 const second=organizationScopes(p).find(s=>s.targets.some(t=>t.number==='2'))!;
 expect(second.source.blocks.map(b=>b.id)).toContain('context');
});
it('英语正文的编号步骤不强制生成伪题',()=>{
 const p=paper('english');p.sources[0].blocks=[{id:'text',text:'Reading text:\n1. Turn off the power.\n2. Wear gloves.\n21. What should you do first?\nA. Turn off the power.\nB. Wear gloves.'}];
 expect(organizationScopes(p).flatMap(s=>s.targets.map(t=>t.number))).toEqual(['21']);
});
it('英语两份试卷的相同题号按各自来源检查与补齐',async()=>{
 const p=paper('english');p.sources[0].blocks=[{id:'a',text:'1. What is the first source?\nA. One\nB. Two'}];
 p.sources.push({id:'s2',name:'第二份卷',role:'paper',kind:'text',blocks:[{id:'b',text:'1. What is the second source?\nA. One\nB. Two'}]});
 p.passages=[passageSchema.parse({id:'old-p',type:'reading',title:'已有篇目',paragraphs:[]})];
 p.questions=[questionSchema.parse({id:'old-q',passageId:'old-p',number:'1',type:'reading',stem:'What is the first source?',options:['A. One','B. Two'],answer:'',versions:[],confirmed:true,excluded:false,stale:false})];
 expect(organizationCoverageIssues(p).join(' ')).toContain('第二份卷');
 const fetch=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({passages:[{id:'p',title:'Reading',type:'reading',paragraphs:[],pool:''}],questions:[{id:'q',passageId:'p',number:'1',type:'reading',stem:'What is the second source?',options:['A. One','B. Two'],answer:''}]})}}]}));vi.stubGlobal('fetch',fetch);
 const out=await organize(p,settings,'synthetic',signal(),{recover:true});expect(fetch).toHaveBeenCalledTimes(1);expect(out.questions).toHaveLength(2);expect(out.questions[0]).toEqual(p.questions[0]);expect(out.organizationIssues).toEqual([]);
});
it.each(['english','chemistry'] as const)('%s 整卷输出截断时按材料范围恢复，不丢掉后续题目',async subject=>{
 const p=paper(subject);let count=0;
 const fetch=vi.fn(async()=>{count++;if(count===1)return Response.json({choices:[{finish_reason:'length',message:{content:'{"questions":['}}]});
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate(subject,count===2?1:2))}}]});});vi.stubGlobal('fetch',fetch);
 const out=await organizeSubject(p);expect((subject==='english'?out.questions:out.chemistry!.questions).map(q=>q.number)).toEqual(['1','2']);expect(out.organizationIssues).toEqual([]);expect(fetch).toHaveBeenCalledTimes(3);
});
it.each(['english','chemistry'] as const)('%s 补回中间缺题时按来源位置插入，不把中间题放到末尾',async subject=>{
 const p=paper(subject);p.sources[0].blocks.push({id:'q3',page:3,text:'3. Third question?\nA. one\nB. two'});
 let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>{
  const output=candidate(subject,1) as any;
  if(++calls===1)output.questions.push({...output.questions[0],id:'q3',number:'3',stem:'Third question?',pages:[3]});else output.questions=[{...output.questions[0],number:'2',stem:'Second question?',pages:[2]}];
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]});
 }));
 const out=await organizeSubject(p);expect((subject==='english'?out.questions:out.chemistry!.questions).map(q=>q.number)).toEqual(['1','2','3']);
});
