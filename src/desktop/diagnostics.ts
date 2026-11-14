import fs from 'node:fs/promises';
import path from 'node:path';
let directory:string|undefined;
const recent:{id:string;record:unknown}[]=[];
export function initializeDiagnostics(userData:string){directory=path.join(userData,'diagnostics');}
export function diagnosticSnapshot(){return structuredClone(recent);}
export async function recordDiagnostic(record:unknown){
 const id=crypto.randomUUID(),text=JSON.stringify({at:new Date().toISOString(),record},(_,v)=>typeof v==='string'?v.replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{25,})\b/g,'[REDACTED]').replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,'[图片内容省略]'):v,2);
 const safe=JSON.parse(text);recent.push({id,record:safe});if(recent.length>30)recent.shift();
 if(directory){await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,id+'.json'),text,{flag:'wx'});}
 return id;
}
export async function annotateFailure(error:unknown,record:unknown):Promise<Error>{
 const failure=error instanceof Error?error:Error(String(error));
 try{const id=await recordDiagnostic({details:record,error:{name:failure.name,message:failure.message}});failure.message+='（本地诊断编号：'+id+'）';}
 catch(writeError){failure.message+='（本地诊断保存失败：'+(writeError instanceof Error?writeError.message:String(writeError))+'）';}
 return failure;
}
export async function preserveFailure(error:unknown,record:unknown):Promise<never>{throw await annotateFailure(error,record);}
