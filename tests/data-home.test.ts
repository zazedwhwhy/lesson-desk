import {expect,it} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {initializeStableData} from '../src/desktop/data-home';
it('首次正式版复制测试版工作数据，原数据与已存在正式版均不覆盖',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-migration-'));
 try{const beta=path.join(root,'beta'),stable=path.join(root,'stable');await fs.mkdir(path.join(beta,'projects','p'),{recursive:true});await fs.writeFile(path.join(beta,'settings.json'),'{"encryptedKey":"synthetic-cipher"}');await fs.writeFile(path.join(beta,'projects','p','project.json'),'original');await fs.writeFile(path.join(beta,'Local State'),'synthetic encryption context');await fs.mkdir(path.join(beta,'Cache'));await fs.writeFile(path.join(beta,'Cache','cache'),'ignore');
 await initializeStableData(stable,[beta]);expect(await fs.readFile(path.join(stable,'Local State'),'utf8')).toBe('synthetic encryption context');expect(await fs.readFile(path.join(stable,'projects','p','project.json'),'utf8')).toBe('original');expect(await fs.readFile(path.join(beta,'projects','p','project.json'),'utf8')).toBe('original');await expect(fs.access(path.join(stable,'Cache'))).rejects.toThrow();
 await fs.writeFile(path.join(stable,'projects','p','project.json'),'new teacher work');await initializeStableData(stable,[beta]);expect(await fs.readFile(path.join(stable,'projects','p','project.json'),'utf8')).toBe('new teacher work');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
it('首次Beta复制正式版错题本，后续各自保存且不回写正式版',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-beta-copy-'));
 try{
  const stable=path.join(root,'stable'),beta=path.join(root,'notebook-beta');await fs.mkdir(path.join(stable,'projects'),{recursive:true});
  await fs.writeFile(path.join(stable,'notebook.json'),'[{"id":"saved-note"}]');await fs.writeFile(path.join(stable,'Local State'),'synthetic-state');
  initializeStableData(beta,[stable]);expect(await fs.readFile(path.join(beta,'notebook.json'),'utf8')).toBe('[{"id":"saved-note"}]');
  await fs.writeFile(path.join(beta,'notebook.json'),'[{"id":"beta-edit"}]');initializeStableData(beta,[stable]);
  expect(await fs.readFile(path.join(stable,'notebook.json'),'utf8')).toBe('[{"id":"saved-note"}]');expect(await fs.readFile(path.join(beta,'notebook.json'),'utf8')).toContain('beta-edit');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
