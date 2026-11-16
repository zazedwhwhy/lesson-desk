import {it,expect,vi,afterEach} from 'vitest';
import {demoProject} from '../src/core/demo';
import {createProofreadRequest} from '../src/core/proofread';
import {splitProofreadInput,PROOFREAD_CHUNK_SIZE} from '../src/core/proofread-chunks';
import {proofreadProject} from '../src/desktop/proofread';
const settings={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
function large(){const p=demoProject();p.sources=[{id:'s',role:'paper',kind:'text',name:'合成原卷',blocks:Array.from({length:20},(_,i)=>({id:'b'+i,text:`第${i}段 `+'原文'.repeat(4500)}))}];return p;}
afterEach(()=>vi.unstubAllGlobals());
function mockRequests(failAt=0,maxInput=Infinity){const sent:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
 const text=JSON.parse(String(init.body)).messages.at(-1).content;const marker='待校对资料：\n';const input=JSON.parse(text.slice(text.indexOf(marker)+marker.length).split('\n')[0]);sent.push(input);
 if(sent.length===failAt)return new Response('{}',{status:401});
 if(JSON.stringify(input).length>maxInput)return Response.json({error:{code:'context_length_exceeded'}},{status:400});
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({coverage:'complete',checkedQuestionIds:input.questions.map((q:any)=>q.id),checkedSourceIds:input.sources.map((s:any)=>s.id),limitations:[],findings:[]})}}]});
 }));return sent;}
it('超过16万字符自动分段，完整保留原文块及题目编号，每段低于预算',()=>{
 const request=createProofreadRequest(large(),true),chunks=splitProofreadInput(request.input);
 expect(JSON.stringify(request.input).length).toBeGreaterThan(160000);expect(chunks.length).toBeGreaterThan(1);
 expect(chunks.every(c=>JSON.stringify(c.input).length<=PROOFREAD_CHUNK_SIZE)).toBe(true);
 for(const b of request.input.sources[0].blocks)expect(chunks.some(c=>c.input.sources.some(s=>s.blocks.some(x=>x.id===b.id&&x.text===b.text)))).toBe(true);
});
it('真实请求链分段发送后合并覆盖，不改原题并显示段进度',async()=>{
 const p=large(),before=structuredClone(p),sent=mockRequests(),messages:string[]=[];
 const out=await proofreadProject(p,settings,'synthetic',true,new AbortController().signal,m=>messages.push(m));
 expect(sent.length).toBeGreaterThan(1);expect(out.proofread?.result.coverage).toBe('complete');expect(out.proofread?.result.checkedQuestionIds).toEqual(p.questions.map(q=>q.id));expect(p).toEqual(before);expect(messages.some(m=>m.includes('第 2/'))).toBe(true);
});
it('超长单段自动分片而不截断，跨片上下文明确标待核对',async()=>{
 const p=large();p.sources[0].blocks=[{id:'long',text:'起始标记'+'长文本'.repeat(60000)+'结束标记'}];const sent=mockRequests();
 const out=await proofreadProject(p,settings,'synthetic',false,new AbortController().signal);
 expect(sent.some(i=>JSON.stringify(i).includes('起始标记'))).toBe(true);expect(sent.some(i=>JSON.stringify(i).includes('结束标记'))).toBe(true);
 expect(out.proofread?.result.coverage).toBe('partial');expect(out.proofread?.result.limitations.join('')).toContain('跨片');
});
it('后段鉴权失败不伪造完整报告、不改变源课件',async()=>{
 const p=large(),before=structuredClone(p),sent=mockRequests(2);
 await expect(proofreadProject(p,settings,'synthetic',false,new AbortController().signal)).rejects.toThrow('401');expect(sent).toHaveLength(2);expect(p).toEqual(before);
});
it('服务明确拒绝上下文长度时只细分当前段并自动重试',async()=>{
 const p=large(),sent=mockRequests(0,25000),messages:string[]=[];
 const out=await proofreadProject(p,settings,'synthetic',false,new AbortController().signal,m=>messages.push(m));
 expect(out.proofread?.result.coverage).toBe('complete');expect(messages.some(m=>m.includes('细分'))).toBe(true);
 expect(sent.some(input=>JSON.stringify(input).length<=25000)).toBe(true);
});
it('大卷中空文本来源仍保留编号，不因分段丢失来源而合并失败',async()=>{
 const p=large();p.sources.push({id:'empty',kind:'text',name:'空答案来源',role:'answer',blocks:[]});mockRequests();
 const out=await proofreadProject(p,settings,'synthetic',false,new AbortController().signal);
 expect(out.proofread?.result.checkedSourceIds).toEqual(['s','empty']);
});
