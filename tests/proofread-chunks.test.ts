import {it,expect,vi,afterEach} from 'vitest';
import {demoProject} from '../src/core/demo';
import {createProofreadRequest} from '../src/core/proofread';
import {splitProofreadInput,PROOFREAD_CHUNK_SIZE} from '../src/core/proofread-chunks';
import {proofreadProject} from '../src/desktop/proofread';
const settings={provider:'deepseek' as const,model:'test',baseUrl:'https://api.deepseek.com'};
function large(){const p=demoProject();p.sources=[{id:'s',role:'paper',kind:'text',name:'合成原卷',blocks:Array.from({length:20},(_,i)=>({id:'b'+i,text:`第${i}段 `+'原文'.repeat(4500)}))}];return p;}
afterEach(()=>vi.unstubAllGlobals());
it('独立校对分段最多三并发，乱序响应仍按原段合并',async()=>{
 const p=large(),before=structuredClone(p),chunks=splitProofreadInput(createProofreadRequest(p,true).input);
 expect(chunks.length).toBeGreaterThanOrEqual(3);
 let active=0,peak=0,started=0,releaseThree!:()=>void,releaseFirst!:()=>void;
 const firstThreeStarted=new Promise<void>(resolve=>{releaseThree=resolve;});
 const secondFinished=new Promise<void>(resolve=>{releaseFirst=resolve;});
 const finished:number[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
  const text=JSON.parse(String(init.body)).messages.at(-1).content,marker='待校对资料：\n';
  const input=JSON.parse(text.slice(text.indexOf(marker)+marker.length).split('\n')[0]);
  const index=input.segment.index-1;
  peak=Math.max(peak,++active);if(++started===3)releaseThree();
  try{
   await firstThreeStarted;
   // Promise gates, rather than equal wall-clock delays, force segment two
   // to finish before segment one on both fast and busy CI machines.
   if(index===0)await secondFinished;
   const source=input.sources.find((s:any)=>s.blocks.length),block=source.blocks[0];
   finished.push(index);if(index===1)releaseFirst();
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
    coverage:'complete',checkedQuestionIds:input.questions.map((q:any)=>q.id),checkedSourceIds:input.sources.map((s:any)=>s.id),limitations:[],
    findings:[{category:'other',severity:'warning',questionIds:input.questions.map((q:any)=>q.id),passageIds:input.passages.map((a:any)=>a.id),
     description:'分段'+(index+1)+'的独立问题',suggestion:'对照本段原文核对',
     evidence:[{sourceId:source.id,blockId:block.id,quote:block.text.slice(0,32)}]}],
   })}}]});
  }finally{active--;}
 }));
 const out=await proofreadProject(p,settings,'synthetic',true,new AbortController().signal);
 expect(peak).toBe(3);expect(active).toBe(0);expect(started).toBe(chunks.length);
 expect(finished.indexOf(1)).toBeLessThan(finished.indexOf(0));
 expect(out.proofread?.result.coverage).toBe('complete');
 expect(out.proofread?.result.checkedQuestionIds).toEqual(p.questions.map(q=>q.id));
 const findings=out.proofread!.result.findings;
 expect(findings.map(f=>f.description)).toEqual(chunks.map((_,i)=>'分段'+(i+1)+'的独立问题'));
 for(const [i,finding] of findings.entries()){
  const source=chunks[i].input.sources.find(s=>s.blocks.length)!,block=source.blocks[0];
  const original=p.sources.find(s=>s.blocks.some(b=>b.text===block.text))!,originalBlock=original.blocks.find(b=>b.text===block.text)!;
  expect(finding.evidence).toEqual([{sourceId:original.id,blockId:originalBlock.id,quote:block.text.slice(0,32)}]);
  expect(finding.questionIds).toEqual(p.questions.map(q=>q.id));
  expect(finding.passageIds).toEqual(p.passages.map(a=>a.id));
 }
 expect(p).toEqual(before);
});
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
 await expect(proofreadProject(p,settings,'synthetic',false,new AbortController().signal)).rejects.toThrow('401');expect(sent.length).toBeLessThanOrEqual(3);expect(p).toEqual(before);
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

it('首次只有一段被接口拒绝后，每个子段仍传递限定范围和片段编号',async()=>{
 const p=large();p.sources[0].blocks=p.sources[0].blocks.slice(0,4);
 expect(splitProofreadInput(createProofreadRequest(p,false).input)).toHaveLength(1);
 const sent=mockRequests(0,16000);
 await proofreadProject(p,settings,'synthetic',false,new AbortController().signal);
 expect(sent.length).toBeGreaterThan(1);
 for(const input of sent.slice(1)){
  expect(input.segment).toBeDefined();
  expect(input.segment.instructions).toContain('其他段未提供的题目或来源不能判为漏题');
  expect(input.segment.total).toBeGreaterThan(1);
 }
});
