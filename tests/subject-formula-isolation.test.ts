import {it,expect} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {demoProject} from '../src/core/demo';
import {emptyProject} from '../src/core/model';
import {chineseSchema,chineseSlides} from '../src/core/chinese';
import {chemQuestionSchema,chemSlides} from '../src/core/chemistry';
import {buildLessonDeck,type LessonSelection} from '../src/core/lesson-deck';
import {exportPpt} from '../src/desktop/export';
it.each(['english','chinese','chemistry'] as const)('%s 的实际课件编译与PPT导出遵循学科公式边界',async subject=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'subject-formula-'));
 try{
  const text=subject==='english'?String.raw`The ticket costs $5 and the book costs $10. Code $\unknown{x}$`:subject==='chinese'?String.raw`原文保留 $5 与 $10，引用代码 $\unknown{x}$ 和未闭合符号 \(。`:String.raw`反应 $\ce{2H2 + O2 -> 2H2O}$，离子 $\ce{SO4^2-}$。`;
  const p=subject==='english'?demoProject():emptyProject('学科隔离合成测试',subject);let selection:LessonSelection|string[],deck:{blocks:{text:string;math?:boolean}[]}[];
  if(subject==='english'){const a=p.passages[0];a.paragraphs=[{id:'plain',text}];selection={passageIds:[a.id],questionIds:[],modules:{[a.id]:['source']}};deck=buildLessonDeck(p,selection);}
  else if(subject==='chinese'){p.chinese=chineseSchema.parse({groups:[{id:'g',title:'原文',section:'阅读',kind:'information',materials:[{id:'m',title:'材料',text,sourceId:'s',blockIds:['b']}],questions:[]}]});selection=['source:g'];deck=chineseSlides(p.chinese,selection);}
  else{p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',number:'1',stem:text,confirmed:true})];selection=['question:q'];deck=chemSlides(p.chemistry!,selection);}
  expect(deck.flatMap(s=>s.blocks).map(b=>b.text).join('')).toBe(text);
  expect(deck.flatMap(s=>s.blocks).some(b=>b.math)).toBe(subject==='chemistry');
  const file=path.join(dir,'output.pptx');expect(await exportPpt(p,file,selection)).toBe(deck.length);
  const files=unzipSync(new Uint8Array(await readFile(file)));expect(Object.keys(files).some(n=>n.endsWith('.svg'))).toBe(subject==='chemistry');
  if(subject!=='chemistry')expect(Object.keys(files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>strFromU8(files[n])).join('')).toContain(text);
 }finally{await rm(dir,{recursive:true,force:true});}
});
