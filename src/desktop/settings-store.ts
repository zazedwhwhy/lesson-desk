import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {connectionSettings,providerPresets} from '../core/ai-settings';
import {generationCounts} from '../core/generation-counts';
import {defaultSettings,type Settings} from '../core/model';

const profileSchema=z.object({id:z.string().min(1),name:z.string().min(1),provider:z.enum(['openai','claude','deepseek','custom']),model:z.string(),baseUrl:z.string(),encryptedKey:z.string().optional()});
const bookSchema=z.object({version:z.literal(1),activeId:z.string(),profiles:z.array(profileSchema),sentenceCount:z.number().optional(),lexiconCount:z.number().optional()}).superRefine((book,ctx)=>{
 if(new Set(book.profiles.map(p=>p.id)).size!==book.profiles.length||book.activeId!==''&&!book.profiles.some(p=>p.id===book.activeId))ctx.addIssue({code:'custom',message:'连接列表或当前连接无效'});
});
type Book=z.infer<typeof bookSchema>;
type Encryption={encrypt:(text:string)=>string;decrypt:(text:string)=>string};
export class SettingsStore{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private file:string,private encryption:Encryption){}
 private async read():Promise<Book>{
  let raw:any;try{raw=JSON.parse(await fs.readFile(this.file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {version:1,activeId:'',profiles:[]};throw error;}
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('连接配置格式无效，请检查设置文件');
  if(raw.version===1)return bookSchema.parse(raw);
  if('version' in raw)throw Error('当前版本无法读取此连接配置版本，请使用保存它的工作台版本');
  // Legacy configuration is migrated in memory; the original file remains
  // intact until an explicit successful save.
  const connection=connectionSettings(raw),id='legacy';
  const encryptedKey=z.string().optional().parse(raw.encryptedKey);
  return {version:1,activeId:id,profiles:[{...connection,id,name:providerPresets[connection.provider].label,encryptedKey}],...generationCounts(raw)};
 }
 private public(book:Book,id=book.activeId):Settings{
  const profile=book.profiles.find(p=>p.id===id);
  if(!profile)return {...defaultSettings,...generationCounts(book),hasKey:false};
  const {encryptedKey,...settings}=profile;
  return {...settings,...generationCounts(book),hasKey:!!encryptedKey};
 }
 private mutate(change:(book:Book)=>void):Promise<Settings>{
  const task=this.queue.then(async()=>{
   const book=await this.read();change(book);bookSchema.parse(book);
   await fs.mkdir(path.dirname(this.file),{recursive:true});
   const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';
   try{await fs.writeFile(tmp,JSON.stringify(book,null,2));await fs.rename(tmp,this.file);}finally{await fs.rm(tmp,{force:true});}
   return this.public(book);
  });
  this.queue=task.catch(()=>{}); // serialize independent edits; return original rejection to caller
  return task;
 }
 async current(){return this.public(await this.read());}
 async list(){const book=await this.read();return book.profiles.map(p=>this.public(book,p.id));}
 async reveal(id:string){const book=await this.read(),profile=book.profiles.find(p=>p.id===id);if(!profile?.encryptedKey)throw Error('此连接没有保存 API Key');return this.encryption.decrypt(profile.encryptedKey);}
 async credentials(){const book=await this.read(),profile=book.profiles.find(p=>p.id===book.activeId);if(!profile?.encryptedKey)throw Error('请先在连接设置中选择已保存的连接，或保存新的 API Key');return {s:this.public(book),key:this.encryption.decrypt(profile.encryptedKey)};}
 save(settings:Settings){return this.mutate(book=>{
  const connection=connectionSettings(settings);
  const previous=settings.id?book.profiles.find(p=>p.id===settings.id):book.profiles.find(p=>p.provider===connection.provider&&p.baseUrl===connection.baseUrl&&p.model===connection.model);
  if(settings.id&&!previous)throw Error('连接已不存在，请重新打开连接设置');
  const sameEndpoint=previous?.provider===connection.provider&&previous.baseUrl.replace(/\/+$/,'')===connection.baseUrl;
  const key=settings.key?.trim();
  if(!key&&!sameEndpoint)throw Error(previous?'服务商或地址已改变，请填写新地址的 API Key':'请填写 API Key 后保存连接');
  const encryptedKey=key?this.encryption.encrypt(key):previous?.encryptedKey;
  if(!encryptedKey)throw Error('请填写 API Key 后保存连接');
  const profile={...connection,id:previous?.id||crypto.randomUUID(),name:settings.name?.trim().slice(0,80)||providerPresets[connection.provider].label,encryptedKey};
  if(previous)book.profiles[book.profiles.indexOf(previous)]=profile;else book.profiles.push(profile);
  book.activeId=profile.id;Object.assign(book,generationCounts({...book,...settings}));
 });}
 activate(id:string){return this.mutate(book=>{if(!book.profiles.some(p=>p.id===id))throw Error('连接已不存在');book.activeId=id;});}
 remove(id:string){return this.mutate(book=>{if(!book.profiles.some(p=>p.id===id))throw Error('连接已不存在');book.profiles=book.profiles.filter(p=>p.id!==id);if(book.activeId===id)book.activeId='';});}
}
