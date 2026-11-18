import {it,expect,vi,afterEach} from 'vitest';
import {emptyProject} from '../src/core/model';
import {chineseSchema} from '../src/core/chinese';
import {generateChinese,organizeChinese,reviewChinese} from '../src/desktop/chinese';
const settings={provider:'custom' as const,model:'test',baseUrl:'https://example.test'};
function project(){const p=emptyProject('语文验证','chinese');p.chinese=chineseSchema.parse({groups:[{id:'g',section:'阅读',title:'资料',kind:'information',materials:[{id:'m',title:'原文',text:'文字证据。',sourceId:'s',blockIds:['b']}],questions:[{id:'q',number:'1',format:'short',stem:'分析文字',materialIds:['m'],confirmed:true}]}]});return p;}
afterEach(()=>vi.unstubAllGlobals());
it('缺参考答案保持待核实；完成项逐项保存并能从失败中继续',async()=>{let n=0;vi.stubGlobal('fetch',vi.fn(async()=>{n++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({status:'ok',notices:[],blocks:[{label:'作答建议',text:'教学分析',evidence:[{materialId:'m',quote:n===2?'伪造':'文字证据。'}]}]})}}]}),{status:200});}));const p=project(),save=vi.fn(async()=>{});await generateChinese(p,['g'],['analysis','structure'],settings,'test',new AbortController().signal,save);expect(p.chinese!.tasks.map(t=>t.state)).toEqual(['complete','failed']);expect(p.chinese!.groups[0].versions[0].result.status).toBe('needs_review');expect(save.mock.calls.length).toBeGreaterThan(2);await generateChinese(p,[],[],settings,'test',new AbortController().signal,save,true);expect(p.chinese!.tasks.every(t=>t.state==='complete')).toBe(true);expect(p.chinese!.groups[0].versions).toHaveLength(2);});
it('鉴权失败停止后续任务且不伪造版本',async()=>{const fetch=vi.fn(async()=>new Response('{}',{status:401}));vi.stubGlobal('fetch',fetch);const p=project();await generateChinese(p,['g'],['analysis','structure','language','practice'],settings,'bad',new AbortController().signal,async()=>{});expect(fetch.mock.calls.length).toBeGreaterThan(0);expect(fetch.mock.calls.length).toBeLessThanOrEqual(3);expect(p.chinese!.groups[0].versions).toHaveLength(0);expect(p.chinese!.tasks[3].state).toBe('pending');});
it('恢复前重新校验教师核对状态',async()=>{const fetch=vi.fn(async()=>new Response('{}',{status:401}));vi.stubGlobal('fetch',fetch);const p=project();await generateChinese(p,['g'],['analysis'],settings,'bad',new AbortController().signal,async()=>{});p.chinese!.groups[0].questions[0].confirmed=false;await expect(generateChinese(p,[],[],settings,'test',new AbortController().signal,async()=>{},true)).rejects.toThrow(/核对/);expect(fetch).toHaveBeenCalledTimes(1);});
it('整理从粘贴的整卷中保留原文片段，不将整卷误作文章',async()=>{const p=project();p.sources=[{id:'s',name:'原卷',role:'paper',kind:'text',blocks:[{id:'b',text:'阅读材料：文字证据。题目：分析文字'}]}];const groups=structuredClone(p.chinese!.groups);groups[0].materials[0].text='文字证据。';vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({groups})}}]}))));const result=await organizeChinese(p,settings,'test',new AbortController().signal);expect(result.chinese.groups[0].materials[0].text).toBe('文字证据。');expect(result.chinese.history).toHaveLength(1);});
it('演练出题和复核不携带原卷答案与材料',async()=>{const bodies:string[]=[];const outputs=[{skill:'证据与推断',format:'简答',constraints:['要求说明依据']},{status:'ok',notices:[],blocks:[{label:'AI新编练习',text:'观察校园植物的记录。说明何者是事实。',evidence:[]},{label:'参考答案',text:'记录的观察值为事实。',evidence:[]}]},{valid:true,reason:'新题完整可解'}];vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{bodies.push(String(init.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outputs[bodies.length-1])}}]}));}));const p=project();await generateChinese(p,['g'],['practice'],settings,'test',new AbortController().signal,async()=>{});expect(bodies).toHaveLength(3);expect(bodies[1]).not.toContain('分析文字');expect(bodies[2]).not.toContain('文字证据。');expect(p.chinese!.groups[0].versions).toHaveLength(1);});
it('AI校对不能虚报遗漏题目已检查全卷',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({coverage:'complete',checkedQuestionIds:[],limitations:[],findings:[]})}}]}))));const p=project();p.sources=[{id:'s',role:'paper',kind:'text',name:'原卷',blocks:[{id:'b',text:'文字证据。'}]}];await expect(reviewChinese(p,settings,'test',new AbortController().signal)).rejects.toThrow(/遗漏/);});

it('缺少原卷时在发送校对请求之前报错',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(reviewChinese(project(),settings,'test',new AbortController().signal)).rejects.toThrow('添加含原文的试卷');
 expect(fetch).not.toHaveBeenCalled();
});
it('材料不足的讲义保留候选并允许续跑',async()=>{
 const raw={status:'insufficient_material',notices:['缺少原文'],blocks:[{label:'待补充',text:'请补全材料',evidence:[]}]};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]})));
 const p=project();await generateChinese(p,['g'],['analysis'],settings,'test',new AbortController().signal,async()=>{});
 expect(p.chinese!.tasks[0]).toMatchObject({state:'failed',error:expect.stringContaining('缺少原文')});
 expect(p.chinese!.groups[0].versions[0].confirmed).toBe(false);
});
