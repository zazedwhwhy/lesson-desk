// Explicit opt-in QA utility; never imported by the packaged application.
const fs=require('node:fs');
const path=require('node:path');
function estimate(body){
 const request=JSON.parse(body);
 if(request.model!=='gpt-6-luna'||request.tools?.length)throw Error('预算测试只允许 gpt-6-luna，禁止工具调用');
 if(!Number.isInteger(request.max_output_tokens)||request.max_output_tokens<1||request.max_output_tokens>32768)throw Error('输出预算无效');
 if(request.service_tier&&request.service_tier!=='default')throw Error('仅允许 Standard 服务层级');
 let images=0;
 const scrubbed=JSON.stringify(request,(_k,v)=>{if(typeof v==='string'&&v.startsWith('data:image/')){images++;return '[image]';}return v;});
 const inputUpper=Buffer.byteLength(scrubbed,'utf8')*2+8192+images*1050000,outputUpper=request.max_output_tokens;
 // Official Standard prices checked 2026-11-16: input $0.10, output $0.50/M.
 // Reserve above long-context/cache-write prices, without cache discounts.
 return {inputUpper,outputUpper,images,reserve:(inputUpper*.5+outputUpper)/1e6};
}
function install({ledgerFile,originalFetch=globalThis.fetch,limit=5,maxRequests=40}){
 const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):{currency:'USD',limit,model:'gpt-6-luna',pricing:'https://developers.openai.com/api/docs/models/gpt-6-luna',entries:[],paused:false};
 if(ledger.limit!==limit||ledger.entries.some(e=>e.status==='reserved'))ledger.paused=true;
 const used=()=>ledger.entries.reduce((sum,e)=>sum+(e.status==='complete'?e.conservativeUsd:e.reserve),0);
 const persist=()=>{fs.mkdirSync(path.dirname(ledgerFile),{recursive:true});const tmp=ledgerFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify({...ledger,totalConservativeUsd:used()},null,2));fs.renameSync(tmp,ledgerFile);};
 persist();
 globalThis.fetch=async(input,init={})=>{
  if(String(input)!=='https://api.openai.com/v1/responses'||init.method!=='POST'||init.redirect!=='error')throw Error('预算闸门拒绝非目标请求');
  if(ledger.paused||ledger.entries.length>=maxRequests)throw Error('预算测试已暂停或达到请求数上限');
  const bound=estimate(init.body);
  if(used()+bound.reserve>limit)throw Error('预算预留将超过5美元，停止调用');
  const entry={number:ledger.entries.length+1,startedAt:new Date().toISOString(),...bound,status:'reserved'};ledger.entries.push(entry);persist();
  const start=Date.now();
  try{
   const response=await originalFetch(input,init);const data=await response.clone().json();const u=data?.usage;
   entry.httpStatus=response.status;entry.elapsedMs=Date.now()-start;entry.responseStatus=data.status;
   if(Number.isInteger(u?.input_tokens)&&u.input_tokens>=0&&Number.isInteger(u.output_tokens)&&u.output_tokens>=0){
    entry.usage=u;entry.conservativeUsd=(u.input_tokens*.5+u.output_tokens)/1e6;entry.standardNoCacheEstimateUsd=(u.input_tokens*.1+u.output_tokens*.5)/1e6;entry.status='complete';
    if(u.input_tokens>bound.inputUpper||u.output_tokens>bound.outputUpper)ledger.paused=true;
   }else{entry.status='unknown';ledger.paused=true;}
   persist();return response;
  }catch(error){entry.status='unknown';entry.elapsedMs=Date.now()-start;ledger.paused=true;persist();throw error;}
 };
 return {ledger,used};
}
module.exports={estimate,install};
