import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {chineseSchema,chineseFingerprint} from '../../src/core/chinese';
import {ChineseTeaching} from '../../src/ui/ChineseTeaching';
import {NotebookManager} from '../../src/ui/NotebookManager';
import {entrySchema,notebookDeck} from '../../src/core/notebook';
import {LessonSlideView} from '../../src/ui/LessonSlideView';
import {builtinPptTemplates} from '../../src/core/ppt-templates';

async function main(){
 const text='千山鸟飞绝，万径人踪灭。\n孤舟蓑笠翁，独钓寒江雪。';
 const data=chineseSchema.parse({groups:[{id:'jiangxue',kind:'poetry',section:'古代诗歌',title:'江雪',materials:[{id:'poem',title:'江雪　柳宗元',text,sourceId:'source',blockIds:['poem']}],questions:[{id:'q',number:'1',stem:'诗人的视线从哪里移向哪里？',materialIds:['poem'],format:'short',answer:'从群山小径，收向江上的一叶孤舟。',answerSource:'teacher',confirmed:true}]}]});
 const g=data.groups[0];
 for(const [module,label,body,quote] of [
  ['structure','由远到近','前两句铺开群山与小径；后两句把视线收向一叶孤舟。','千山鸟飞绝，万径人踪灭。'],
  ['language','把两个字读重','“孤”落在舟上，“独”落在人身上。一舟一人，把寒江写得更空。','孤舟蓑笠翁，独钓寒江雪。']
 ] as const){
  g.versions.push({id:module,module,createdAt:'2026-11-20T12:00:00Z',confirmed:true,fingerprint:chineseFingerprint(data,g),result:{status:'ok',notices:[],blocks:[{label,text:body,evidence:[{materialId:'poem',quote}]}]}});
 }
 const css=(await Promise.all(['style','paper','chinese','notebook','ppt-templates'].map(s=>readFile('src/ui/'+s+'.css','utf8')))).join('\n').replaceAll('../../assets/',pathToFileURL(path.resolve('assets')).href+'/');
 const work=path.resolve('designs/lesson-desk-rhythm/work');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const tab=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1.5});
  for(const module of ['structure','language'] as const){
   const html=renderToStaticMarkup(<ChineseTeaching data={data} groupId={g.id} onGroup={()=>{}} module={module} onModule={()=>{}} mode="compare" setMode={()=>{}} font={26} translated={false} busy={false} prepare={()=>{}} generate={()=>{}} edit={async()=>{}}/>);
   const file=path.join(work,module+'.html');
   await writeFile(file,'<!doctype html><meta charset=utf-8><style>'+css+' body{margin:0}.classroom{height:calc(100vh - 56px)}</style>'+html);
   await tab.goto(pathToFileURL(file).href);await tab.evaluate(()=>document.fonts.ready);
   await tab.screenshot({path:path.join(work,module+'.png')});
  }
  const entry=entrySchema.parse({id:'ed969af0-c151-42ed-95db-14622a2ca062',createdAt:'2026-11-20',projectId:'reading',projectTitle:'放学以后',subject:'english',kind:'question',title:'找准 who 指代的人',text:'Who was afraid of the dark?',context:'指代前面的 Sam。',studentText:'Who was afraid of the dark?',material:'Mia chose to walk home with Sam, who was afraid of the dark.',answer:'Sam was afraid of the dark.',tags:['定语从句','指代'],reviewed:true,studentReady:true});
  const deck=notebookDeck([entry],{ids:[entry.id],audience:'student',modules:['question']});
  const views=[['notebook',<NotebookManager items={[entry]} onItems={()=>{}} onClose={()=>{}}/>],['notebook-show',<LessonSlideView slide={deck[0] as any} template={builtinPptTemplates[0]} projectTitle={entry.projectTitle} page={1} total={1}/>]] as const;
  for(const [name,element] of views){
   const file=path.join(work,name+'.html');
   await writeFile(file,'<!doctype html><meta charset=utf-8><style>'+css+' body{margin:0}.nb-manager{position:static;display:block;margin:auto;width:100vw;height:100vh;max-height:none;max-width:none}.ppt-slide-view{width:1280px!important;height:720px!important}</style>'+renderToStaticMarkup(element));
   await tab.goto(pathToFileURL(file).href);await tab.evaluate(()=>document.fonts.ready);await tab.screenshot({path:path.join(work,name+'.png')});
  }
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
