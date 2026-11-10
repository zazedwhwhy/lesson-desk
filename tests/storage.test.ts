import { it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { Store } from '../src/desktop/store';
import { demoProject } from '../src/core/demo';
import { applyCorrections, undoCorrection } from '../src/core/correction';
let roots: string[] = [];
afterEach(async () => { await Promise.all(roots.map(p => rm(p, { recursive: true, force: true }))); roots = []; });
async function store() { const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-test-')); roots.push(root); return new Store(root); }
it('保存重载并恢复中断状态', async () => { const s = await store(), p = demoProject(); p.job.state = 'running'; await s.save(p); expect((await s.load(p.id)).job.state).toBe('interrupted'); });
it('列出课件时只读，不把正在运行的任务误写成中断',async()=>{const s=await store(),p=demoProject();p.job.state='running';await s.save(p);await s.list();expect(JSON.parse(await readFile(path.join(s.dir(p.id),'project.json'),'utf8')).job.state).toBe('running');});
it('打包导入使用新ID且保留内容', async () => { const s = await store(), p = demoProject(); await s.save(p); const q = await s.unpack(await s.pack(p.id)); expect(q.id).not.toBe(p.id); expect(q.questions).toEqual(p.questions); });
it('拒绝缺资源课件包', async () => { const s = await store(), p = demoProject(); p.sources = [{ id: 'source', name: 'lost.pdf', role: 'paper', kind: 'pdf', blocks: [], asset: 'sources/lost.pdf' }]; await expect(s.unpack(zipSync({ 'project.json': strToU8(JSON.stringify(p)) }))).rejects.toThrow('缺少原材料'); });
it('校对报告随课件保存和导入，旧课件无需迁移', async()=>{
  const s=await store(),p=demoProject();p.proofread={id:'report',createdAt:new Date().toISOString(),provider:'deepseek',model:'test',includeExplanations:false,inputSnapshot:'snapshot',result:{coverage:'partial',checkedQuestionIds:[],checkedSourceIds:[],limitations:['测试报告'],findings:[]}};
  await s.save(p);const imported=await s.unpack(await s.pack(p.id));expect(imported.proofread).toEqual(p.proofread);
});
it('自动修正快照随课件包转移，导入后仍可撤销',async()=>{
  const s=await store(),p=demoProject(),q=p.questions[0];p.sources=[{id:'key',role:'answer',kind:'text',name:'答案',blocks:[{id:'b',text:'21-23 BCA'}]}];
  const next=applyCorrections(p,{operations:[{kind:'question',questionId:q.id,field:'answer',before:'A',after:'B',reason:'来源答案',evidence:[{sourceId:'key',blockId:'b',quote:'21-23 BCA'}]}],unresolved:[]},{provider:'deepseek',model:'test'},false);
  await s.save(next);const imported=await s.unpack(await s.pack(next.id));expect(imported.corrections).toEqual(next.corrections);expect(undoCorrection(imported).questions).toEqual(p.questions);
});
it('移走整份课件后保留其他课件和外部原文件',async()=>{
  const s=await store(),p=demoProject(),other=demoProject();other.id='other';await s.save(p);await s.save(other);
  await s.asset(p.id,'sources/copy.pdf',new Uint8Array([1,2,3]));const original=path.join(s.root,'original.pdf');await writeFile(original,'original');
  const recycled=s.root+'-recycled';roots.push(recycled);await s.trash(p.id,dir=>rename(dir,recycled));
  expect((await s.list()).map(x=>x.id)).toEqual(['other']);expect(await readFile(original,'utf8')).toBe('original');expect(await readFile(path.join(recycled,'sources/copy.pdf'))).toEqual(Buffer.from([1,2,3]));
});
it('回收站失败就保留课件并报告原错误，不退化为永久删除',async()=>{
  const s=await store(),p=demoProject();await s.save(p);await expect(s.trash(p.id,async()=>{throw Error('回收站不可用');})).rejects.toThrow('回收站不可用');expect((await s.load(p.id)).title).toBe(p.title);
});
it('删除拒绝目录穿越和缺失课件，不调用系统回收站',async()=>{
  const s=await store();let calls=0;const trash=async()=>{calls++;};await expect(s.trash('../outside',trash)).rejects.toThrow('课件ID');await expect(s.trash('missing',trash)).rejects.toThrow();expect(calls).toBe(0);
});
