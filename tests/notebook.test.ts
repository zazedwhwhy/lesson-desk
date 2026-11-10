import {test,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {NotebookStore} from '../src/desktop/notebook';
test('parallel collections persist across reopening and undo preserves other entries',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'notebook-'));try{const file=path.join(dir,'book.json'),s=new NotebookStore(file);const entry=()=>({id:crypto.randomUUID(),createdAt:new Date().toISOString(),projectId:'p',projectTitle:'来源',subject:'english',kind:'excerpt',title:'句子',text:crypto.randomUUID(),context:'原文'});const a=entry(),b=entry();await Promise.all([s.add(a),s.add(b)]);expect(await new NotebookStore(file).list()).toHaveLength(2);await s.remove(a.id);expect((await s.list())[0].id).toBe(b.id);await fs.writeFile(file,'broken');await expect(s.add(entry())).rejects.toThrow();expect(await fs.readFile(file,'utf8')).toBe('broken');}finally{await fs.rm(dir,{recursive:true,force:true});}});
