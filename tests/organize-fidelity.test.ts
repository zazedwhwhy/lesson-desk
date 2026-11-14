import {it,expect,vi,afterEach} from 'vitest';
import {emptyProject} from '../src/core/model';
import {organize} from '../src/desktop/ai';
import {organizeChemistry} from '../src/desktop/chemistry';
import {organizeChinese} from '../src/desktop/chinese';
const settings={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
afterEach(()=>vi.unstubAllGlobals());
function response(value:unknown){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})));}
it('英语整理丢失原文空号时拒绝替换原课件',async()=>{
 const p=emptyProject('原课件');p.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',text:'A story. 42 Three hours away.\n42. Choose a word.\nA. only B. still'}]}];
 const before=structuredClone(p);response({passages:[{id:'a',title:'完形',type:'cloze',paragraphs:[{id:'p',text:'A story. Three hours away.'}],pool:''}],questions:[{id:'q',number:'42',passageId:'a',type:'cloze',stem:'Choose a word.',options:['A. only','B. still'],answer:''}]});
 await expect(organize(p,settings,'synthetic',new AbortController().signal)).rejects.toThrow(/保真/);expect(p).toEqual(before);
});
it('语文整理不得改动有来源的选项字面',async()=>{
 const p=emptyProject('语文','chinese');p.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',text:'原文。\n1.选出错误的一项\nA.从化学物质中获取能量\nB.其他'}]}];const before=structuredClone(p);
 response({groups:[{id:'g',section:'阅读',title:'阅读',kind:'information',materials:[{id:'m',title:'材料',text:'原文。',sourceId:'s',blockIds:['b']}],questions:[{id:'q',number:'1',stem:'选出错误的一项',format:'choice',materialIds:['m'],options:['A.从有机物质中获取能量','B.其他'],answer:'',answerSource:'none',confirmed:false,excluded:false}]}]});
 await expect(organizeChinese(p,settings,'synthetic',new AbortController().signal)).rejects.toThrow(/保真/);expect(p).toEqual(before);
});
it('化学整理不得漏掉同一小问中的气体追问',async()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',page:1,text:'16.⑶铜的存在形式为___。气体a为___。'}]}];const before=structuredClone(p);
 response({questions:[{number:'16',kind:'process',stem:'⑶铜的存在形式为___。',options:[],answer:'',sourceId:'s',pages:[1]}]});
 await expect(organizeChemistry(p,settings,'synthetic',new AbortController().signal)).rejects.toThrow(/保真/);expect(p).toEqual(before);
});
it('引用来源无效的整理候选也保存诊断且不改变旧课件',async()=>{
 const p=emptyProject('化学','chemistry'),before=structuredClone(p);response({questions:[{number:'16',kind:'process',stem:'原题',options:[],answer:'',sourceId:'missing',pages:[1]}]});
 await expect(organizeChemistry(p,settings,'synthetic',new AbortController().signal)).rejects.toThrow(/来源.*诊断编号/);expect(p).toEqual(before);
});
