import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {entrySchema,type NotebookEntry} from '../core/notebook';
export {entrySchema,type NotebookEntry} from '../core/notebook';
export class NotebookStore{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 async list(includeArchived=false):Promise<NotebookEntry[]>{try{const items=z.array(entrySchema).parse(JSON.parse(await fs.readFile(this.file,'utf8')));return includeArchived?items:items.filter(e=>!e.archived);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
 private change(fn:(items:NotebookEntry[])=>NotebookEntry[]){const task=this.queue.then(async()=>{const old=await this.list(true),items=fn(old);await fs.mkdir(path.dirname(this.file),{recursive:true});try{await fs.copyFile(this.file,this.file+'.before-upgrade.json',fs.constants.COPYFILE_EXCL);}catch(e){if(!['ENOENT','EEXIST'].includes((e as NodeJS.ErrnoException).code||''))throw e;}const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(items,null,2));await fs.rename(tmp,this.file);}catch(e){await fs.rm(tmp,{force:true});throw e;}return items;});this.queue=task.catch(()=>{});return task;}
 add(value:unknown){const entry=entrySchema.parse(value);return this.change(items=>{if(items.some(e=>e.id===entry.id))throw Error('条目编号重复');if(items.some(e=>!e.archived&&e.projectId===entry.projectId&&e.sourceId===entry.sourceId&&e.kind===entry.kind&&e.text===entry.text&&e.context===entry.context))throw Error('此内容已收录，请打开错题本补充班级或学生记录');return [entry,...items];});}
 update(value:unknown){const entry=entrySchema.parse(value);return this.change(items=>{const index=items.findIndex(e=>e.id===entry.id);if(index<0)throw Error('条目已不存在');const old=items[index];if(old.revision!==entry.revision)throw Error('条目已被更新，请刷新后再保存');for(const record of old.records){const next=entry.records.find(r=>r.id===record.id);if(!next||record.reviews.some(r=>!next.reviews.some(n=>JSON.stringify(n)===JSON.stringify(r))))throw Error('已保存的复测历史不能覆盖或删除');}if(new Set(entry.records.map(r=>r.className+'\0'+r.student)).size!==entry.records.length)throw Error('同一班级或学生已有记录，请补充原记录');items[index]={...entry,revision:old.revision+1};return items;});}
 remove(id:string){return this.change(items=>items.map(e=>e.id===id?{...e,archived:true,revision:e.revision+1}:e));}
}
