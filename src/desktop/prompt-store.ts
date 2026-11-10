import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {promptCatalog} from '../core/prompt-catalog';
const overrideSchema=z.record(z.string(),z.object({instruction:z.string().trim().min(1).max(50000),system:z.string().trim().min(1).max(20000)}));
const storedSchema=z.object({overrides:overrideSchema,templates:z.array(z.object({id:z.string(),title:z.string(),instruction:z.string(),system:z.string()}))});
type Override=z.infer<typeof overrideSchema>;
export class PromptBook{
 overrides:Override={};
 entries=new Map<string,{id:string;title:string;instruction:string;system:string;lastRequest?:unknown}>();
 constructor(){for(const entry of promptCatalog())this.entries.set(entry.id,entry);}
 compose(prompt:string,system:string){
  const module=prompt.match(/本次仅生成(\w+)字段/)?.[1];
  const registered=promptCatalog().find(e=>prompt.includes(e.instruction));
  const id=module||registered?.id|| (prompt.startsWith('教学内容复核：')?'review-'+prompt.split('\n')[0].split('：')[1]:prompt.includes('独立练习任务：')?'practice':prompt.includes('仅生成原题解析')?'analysis':prompt.includes('只逐段翻译')?'translation':prompt.includes('仅提炼此题')?'blueprint':prompt.includes('待校对资料：')?'proofread':prompt.includes('自动修正资料：')?'correction':prompt.startsWith('转录这一页')?'ocr':'other-'+prompt.slice(0,32));
  const markers=['\n输入材料：','\n输入：','\n材料：','\n待复核资料：','\n独立练习任务：','\n待校对资料：','\n自动修正资料：','当前第','\n{','\n['];
  const positions=markers.map(m=>prompt.indexOf(m,registered?prompt.indexOf(registered.instruction)+registered.instruction.length:0)).filter(n=>n>=0),at=positions.length?Math.min(...positions):prompt.length;
  const prefix=registered?prompt.slice(0,prompt.indexOf(registered.instruction)):'';
  const instruction=registered?.instruction??prompt.slice(0,at),suffix=prompt.slice(at);
  const names:Record<string,string>={structure:'篇章脉络',imitation:'表达迁移',practice:'考点演练',analysis:'逐题解析',translation:'原文译文',blueprint:'练习考点提炼',proofread:'试卷校对',correction:'自动修正',ocr:'扫描识别','review-structure':'篇章内容复核','review-lexicon':'词汇内容复核','review-practice':'练习内容复核'};
  const entry=this.entries.get(id)||{id,title:names[id]||id,instruction,system};
  entry.instruction=instruction;entry.system=system;this.entries.set(id,entry);
  const custom=this.overrides[id];return{id,prompt:prefix+(custom?.instruction??instruction)+suffix,system:custom?.system??system};
 }
 record(id:string,request:unknown){this.entries.get(id)!.lastRequest=request;}
 snapshot(){return [...this.entries.values()].map(e=>({...e,effective:this.overrides[e.id]||{instruction:e.instruction,system:e.system},custom:!!this.overrides[e.id]}));}
}
export const promptBook=new PromptBook();
let file:string|undefined;
export async function initializePrompts(root:string){file=path.join(root,'prompts.json');try{const stored=storedSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));promptBook.overrides=stored.overrides;for(const e of stored.templates){const mapped=promptCatalog().find(t=>t.instruction===e.instruction)?.id||e.id;if(mapped!==e.id&&stored.overrides[e.id]&&!promptBook.overrides[mapped])promptBook.overrides[mapped]=stored.overrides[e.id];if(!promptBook.entries.has(mapped))promptBook.entries.set(mapped,{...e,id:mapped});}}catch(e:any){if(e.code!=='ENOENT')throw e;}}
export async function savePrompt(id:string,value:unknown){
 if(!file||!promptBook.entries.has(id))throw Error('提示词任务不存在');
 const next={...promptBook.overrides};if(value===null)delete next[id];else next[id]=overrideSchema.parse({[id]:value})[id];
 const templates=[...promptBook.entries.values()].map(({id,title,instruction,system})=>({id,title,instruction,system}));
 const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify({overrides:next,templates},null,2));await fs.rename(tmp,file);promptBook.overrides=next;return promptBook.snapshot();
}
