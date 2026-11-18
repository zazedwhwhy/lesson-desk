import {it,expect,vi,afterEach} from 'vitest';
import {emptyProject} from '../src/core/model';
import {organizeChinese} from '../src/desktop/chinese';
import {chineseGroupSchema} from '../src/core/chinese';
import {planChineseSections} from '../src/core/chinese-organization';
afterEach(()=>vi.unstubAllGlobals());
it('整卷含两篇时不能静默只保留第一篇，后续篇目应分别整理',async()=>{
 const p=emptyProject('合成语文卷','chinese');
 p.sources=[{id:'s',name:'卷',kind:'text',role:'paper',blocks:[{id:'h1',text:'（一）阅读Ⅰ（本题共1小题，3分）'},{id:'m1',text:'第一篇完整原文。'},{id:'q1',text:'1. 第一题（3分）'},{id:'h2',text:'（二）阅读Ⅱ（本题共1小题，3分）'},{id:'m2',text:'第二篇完整原文。'},{id:'q2',text:'2. 第二题（3分）'}]}];
 const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const prompt=JSON.parse(String(init.body)).messages.at(-1).content as string;calls.push(prompt);
  // Reproduce a model that only organizes the first section when asked for both.
  const n=prompt.includes('第一篇完整原文')?1:2;
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({groups:[{id:'g'+n,section:'阅读',title:'阅读'+n,kind:'information',materials:[{id:'m'+n,title:'原文',text:n===1?'第一篇完整原文。':'第二篇完整原文。',sourceId:'s',blockIds:['m'+n]}],questions:[{id:'q'+n,number:String(n),stem:n===1?'第一题':'第二题',format:'short',materialIds:['m'+n],options:[],answer:'',answerSource:'none',confirmed:false,excluded:false}]}]})}}]});}));
 const out=await organizeChinese(p,{provider:'custom',model:'test',baseUrl:'https://example.test'},'synthetic',new AbortController().signal);
 expect(out.chinese!.groups.flatMap(g=>g.questions.map(q=>q.number))).toEqual(['1','2']);expect(calls).toHaveLength(2);
});
it('已有第一篇及教师讲评保留，只请求后面的篇目；失败有报告且可再次补齐',async()=>{
 const p=emptyProject('补齐语文','chinese');
 p.sources=[{id:'s',name:'卷',kind:'text',role:'paper',blocks:[{id:'h1',text:'（一）阅读Ⅰ（本题共1小题，3分）'},{id:'m1',text:'第一篇原文'},{id:'q1',text:'1. 第一题（3分）'},{id:'h2',text:'（二）阅读Ⅱ（本题共1小题，3分）'},{id:'m2',text:'第二篇原文'},{id:'q2',text:'2. 第二题（3分）'}]}];
 const group=(n:number)=>chineseGroupSchema.parse({id:'g'+n,section:'阅读',title:'阅读'+n,kind:'information',materials:[{id:'m'+n,title:'原文',text:n===1?'第一篇原文':'第二篇原文',sourceId:'s',blockIds:['m'+n]}],questions:[{id:'q'+n,number:String(n),stem:n===1?'第一题':'第二题',format:'short',materialIds:['m'+n]}]});
 p.chinese!.groups=[group(1)];p.chinese!.groups[0].versions.push({id:'teacher',module:'analysis',createdAt:'before',fingerprint:'saved',confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'教师讲评',text:'已有讲评',evidence:[]}]}});
 const first=structuredClone(p.chinese!.groups[0]),before=structuredClone(p);let valid=false;const prompts:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{prompts.push(JSON.parse(String(init.body)).messages.at(-1).content);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({groups:[group(valid?2:1)]})}}]});}));
 const settings={provider:'custom' as const,model:'test',baseUrl:'https://example.test'};
 const partial=await organizeChinese(p,settings,'synthetic',new AbortController().signal);
 expect(partial.chinese!.groups).toEqual([first]);expect(partial.chinese!.organizationIssues).toHaveLength(1);expect(prompts).toHaveLength(2);expect(prompts.every(text=>!text.includes('第一篇原文'))).toBe(true);expect(p).toEqual(before);
 valid=true;const recovered=await organizeChinese(partial,settings,'synthetic',new AbortController().signal);
 expect(recovered.chinese!.groups[0]).toEqual(first);expect(recovered.chinese!.groups.flatMap(g=>g.questions.map(q=>q.number))).toEqual(['1','2']);expect(recovered.chinese!.organizationIssues).toEqual([]);expect(prompts).toHaveLength(3);
});
it('七个标准板块的1至23题均有独立整理范围，忽略卷首答题说明',()=>{
 const p=emptyProject('整卷','chinese');let number=0;
 p.sources=[{id:'s',name:'卷',role:'paper',kind:'text',blocks:[{id:'rules',text:'1. 请填写姓名。\n2. 请在答题卡作答。'},...['（一）阅读Ⅰ','（二）阅读Ⅱ','（三）阅读Ⅲ','（四）阅读Ⅳ','（五）名篇名句默写','二、语言文字运用','三、作文'].flatMap((text,i)=>[{id:'h'+i,text},...Array.from({length:[5,4,5,2,1,5,1][i]},()=>({id:'q'+(++number),text:number+'. 题干（3分）'}))])]}];
 const sections=planChineseSections(p);expect(sections).toHaveLength(7);expect(sections.flatMap(s=>s.numbers)).toEqual(Array.from({length:23},(_,i)=>String(i+1)));
});
it('首个独立标题之前已有试题时仍纳入整理与覆盖检查',()=>{
 const p=emptyProject('合并标题','chinese');
 p.sources=[{id:'s',name:'卷',role:'paper',kind:'text',blocks:[{id:'title',text:'模拟试卷\n一、现代文阅读'},{id:'q1',text:'1. 第一篇题目。（3分）'},{id:'h2',text:'二、古代诗文阅读'},{id:'q2',text:'2. 第二篇题目。（3分）'}]}];
 expect(planChineseSections(p).flatMap(s=>s.numbers)).toEqual(['1','2']);
});
it('服务中断后未执行的篇目保留教师编辑与已有讲评',async()=>{
 const p=emptyProject('中断保留','chinese');
 p.sources=[{id:'s',name:'卷',role:'paper',kind:'text',blocks:[{id:'h1',text:'（一）阅读Ⅰ'},{id:'q1',text:'1. 第一题（3分）'},{id:'h2',text:'（二）阅读Ⅱ'},{id:'m2',text:'第二篇原文'},{id:'q2',text:'2. 第二题（3分）'}]}];
 const saved=chineseGroupSchema.parse({id:'edited',section:'阅读',title:'教师编辑篇目',kind:'information',materials:[{id:'m',title:'原文',text:'教师校正后的原文',sourceId:'s',blockIds:['m2']}],questions:[{id:'q',number:'2',stem:'第二题',format:'short',materialIds:['m']}],versions:[{id:'teacher',module:'analysis',createdAt:'before',fingerprint:'saved',confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'教师讲评',text:'已有讲评',evidence:[]}]}}]});
 p.chinese!.groups=[saved];const before=structuredClone(p);
 const fetch=vi.fn(async()=>Response.json({error:{message:'unauthorized'}},{status:401}));vi.stubGlobal('fetch',fetch);
 const out=await organizeChinese(p,{provider:'custom',model:'test',baseUrl:'https://example.test'},'synthetic',new AbortController().signal);
 expect(out.chinese.groups[0]).toEqual({...saved,sourceNeedsReview:true,versions:saved.versions.map(v=>({...v,confirmed:false})),questions:saved.questions.map(q=>({...q,confirmed:false}))});expect(out.chinese.history.at(-1)?.groups).toEqual([saved]);expect(out.chinese.organizationIssues).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(1);expect(p).toEqual(before);
});
