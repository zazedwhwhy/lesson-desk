import {it,expect,vi,afterEach} from 'vitest';
import {z} from 'zod';
import {callAI} from '../src/desktop/ai';
import {diagnosticSnapshot,initializeDiagnostics,preserveFailure} from '../src/desktop/diagnostics';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
afterEach(()=>vi.unstubAllGlobals());
it('无效输出保留诊断，不保存凭据或图片内容',async()=>{
 const raw='not JSON';vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:raw}}]})));
 await expect(callAI({provider:'custom',model:'test',baseUrl:'https://example.test'},'sk-1234567890123456789012345',z.object({ok:z.boolean()}),'test',new AbortController().signal)).rejects.toThrow(/诊断编号/);
 const d=JSON.stringify(diagnosticSnapshot().at(-1));expect(d).toContain(raw);expect(d).not.toContain('sk-1234567890123456789012345');expect(d).not.toContain('Authorization');
});
it('诊断确实写入本地，保存失败仍保留原异常类型与上下文',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lesson-diagnostic-'));
 try{
  initializeDiagnostics(dir);const failure=new TypeError('原始结构校验失败');
  await expect(preserveFailure(failure,{candidate:{text:'原始候选'}})).rejects.toBe(failure);
  const files=await fs.readdir(path.join(dir,'diagnostics'));expect(files).toHaveLength(1);expect(await fs.readFile(path.join(dir,'diagnostics',files[0]),'utf8')).toContain('原始候选');
  const file=path.join(dir,'read-only-file');await fs.writeFile(file,'x');initializeDiagnostics(file);
  const original=new RangeError('原题选项超出范围');
  await expect(preserveFailure(original,{candidate:'候选'})).rejects.toBe(original);
  expect(original.message).toContain('诊断保存失败');
 }finally{initializeDiagnostics(dir);await fs.rm(dir,{recursive:true,force:true});}
});
