import {afterEach, expect, it} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SettingsStore} from '../src/desktop/settings-store';
const dirs:string[]=[];
const encryption={encrypt:(s:string)=>Buffer.from(s).toString('base64'),decrypt:(s:string)=>Buffer.from(s,'base64').toString()};
async function setup(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'desk-settings-'));dirs.push(dir);return {file:path.join(dir,'settings.json'),store:new SettingsStore(path.join(dir,'settings.json'),encryption)};}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>fs.rm(dir,{recursive:true,force:true})));});
const openai={provider:'openai' as const,model:'model-a',baseUrl:'https://api.openai.com/v1',key:'synthetic-a'};
it('迁移单连接并仅在显式查看时返回密钥',async()=>{const {file,store}=await setup();await fs.writeFile(file,JSON.stringify({...openai,key:undefined,encryptedKey:encryption.encrypt(openai.key)}));const s=await store.current();expect(s.hasKey).toBe(true);expect(JSON.stringify(await store.list())).not.toContain('synthetic-a');expect(s).not.toHaveProperty('encryptedKey');expect(await store.reveal(s.id!)).toBe('synthetic-a');});
it('多个连接保存后可切换，旧密钥与模型仍可查看',async()=>{const {store}=await setup();const a=await store.save(openai);const b=await store.save({...openai,id:undefined,model:'model-b',key:'synthetic-b'});expect(a.id).not.toBe(b.id);expect(await store.list()).toHaveLength(2);expect((await store.activate(a.id!)).model).toBe('model-a');expect(await store.reveal(a.id!)).toBe('synthetic-a');});
it('修改地址不能继承原服务密钥，失败保留原连接',async()=>{const {store}=await setup();const a=await store.save(openai);await expect(store.save({...a,baseUrl:'https://other.example/v1',key:''})).rejects.toThrow('新地址');expect((await store.current()).baseUrl).toBe(openai.baseUrl);expect(await store.reveal(a.id!)).toBe('synthetic-a');});
it('同地址换模型留空保留密钥，新密钥不进入公开快照',async()=>{const {store,file}=await setup();const a=await store.save(openai);await store.save({...a,model:'model-c',key:''});expect(await store.reveal(a.id!)).toBe('synthetic-a');expect(await fs.readFile(file,'utf8')).not.toContain('synthetic-a');});
it('损坏配置直接报错，不能用默认设置覆盖',async()=>{const {store,file}=await setup();await fs.writeFile(file,'{broken');await expect(store.current()).rejects.toThrow();await expect(store.save(openai)).rejects.toThrow();expect(await fs.readFile(file,'utf8')).toBe('{broken');});
it('删除当前连接后明确切换到剩余连接，最后一项删除后无密钥',async()=>{const {store}=await setup();const a=await store.save(openai);const b=await store.save({...openai,model:'model-b'});await store.remove(b.id!);expect((await store.current()).id).toBe(a.id);await store.remove(a.id!);expect((await store.current()).hasKey).toBe(false);expect(await store.list()).toEqual([]);});
