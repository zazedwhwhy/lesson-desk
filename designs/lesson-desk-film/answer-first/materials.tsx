import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
import {buildSkillLesson} from '../../../skills/lesson-desk-export/tool/build-lesson';
import {buildLessonDeck} from '../../../src/core/lesson-deck';
import {builtinPptTemplates} from '../../../src/core/ppt-templates';
import {exportPpt} from '../../../src/desktop/export';
import {SourceMaterials} from '../../../src/ui/SourceMaterials';
import {LessonSetupView} from '../../../src/ui/LessonSetupView';
import {LessonSlideView} from '../../../src/ui/LessonSlideView';
import {ProjectLibrary} from '../../../src/ui/ProjectLibrary';

const work = path.resolve('designs/lesson-desk-film/answer-first/work');
const passage = 'Mia could still catch her bus. Yet she chose to walk home with Sam, who was afraid of the dark.';
const prompt = '哪几个词告诉你，她是为了 Sam？';
const answer = '她想陪怕黑的 Sam 一起回家。';
const items = [
  ['7','Could Mia still catch her bus?','Yes.','could still catch her bus','still 表明她仍然来得及。'],
  ['8','Why did Mia walk home?\n'+prompt,answer,'who was afraid of the dark','Yet 提醒我们注意转折。who 指 Sam；怕黑的是 Sam。'],
  ['9','Who was afraid of the dark?','Sam.','Sam, who was afraid of the dark','关系代词 who 指代前面的 Sam。'],
];
const manifest = {project:{title:'放学以后 · 阅读讲评',subject:'english',
  sources:[{id:'paper',name:'放学以后 · 阅读试卷',kind:'text',role:'paper',blocks:[{id:'p1',text:passage},...items.map(([n,q])=>({id:'s'+n,text:n+'. '+q}))]},
    {id:'key',name:'阅读参考答案',kind:'text',role:'answer',blocks:items.map(([n,,a])=>({id:'a'+n,text:n+'. '+a}))}],
  passages:[{id:'reading',title:'放学以后',type:'reading',paragraphs:[{id:'p1',text:passage}]}],
  questions:items.map(([n,stem,ans,quote,analysis])=>({id:'q'+n,number:n,sourceId:'paper',passageId:'reading',type:'reading',stem,options:[],answer:ans,analysis:{answer:ans,text:analysis,evidence:[{blockId:'p1',quote}]}}))}};

async function main(){
  await fs.mkdir(work,{recursive:true});
  await fs.writeFile(path.join(work,'input.json'),JSON.stringify(manifest,null,2));
  const out=await fs.mkdtemp(path.join(work,'skill-'));
  const made=await buildSkillLesson(manifest,work,path.join(out,'result'));
  const project=JSON.parse(strFromU8(unzipSync(await fs.readFile(made.bundle))['project.json']));
  const preview=structuredClone(project);
  for(const q of preview.questions) q.confirmed=true;
  const selection={passageIds:['reading'],questionIds:['q8'],modules:{reading:['source','analysis']}};
  const noop=()=>{};
  const cssFiles=['style','paper','library-workspace','preparation','lesson-deck','ppt-templates'];
  const css=(await Promise.all(cssFiles.map(s=>fs.readFile('src/ui/'+s+'.css','utf8')))).join('\n').replaceAll('../../assets/',pathToFileURL(path.resolve('assets')).href+'/');
  async function plate(name:string,element:React.ReactNode,extra=''){
    const html='<!doctype html><meta charset="utf-8"><style>'+css+'\nbody{margin:0;padding:30px;background:#f7f3ea;overflow:hidden}.ppt-slide-view{width:1200px!important;margin:0!important}'+extra+'</style>'+renderToStaticMarkup(element);
    await fs.writeFile(path.join(work,name+'.html'),html);
  }
  for(const id of ['paper','key'])await plate('source-'+id,<SourceMaterials project={preview} sourceId={id} paste="" setPaste={noop} setSourceId={noop} busy={false} change={async()=>{}} task={async()=>{}} run={async()=>{}}/>);
  await plate('library',<ProjectLibrary items={[]} loading={false} loadError="" busy={false} reload={noop} create={noop} open={noop} remove={noop} importBundle={noop} example={noop}/>);
  const deckIndex:any={};
  for(const template of builtinPptTemplates){
    const deck=buildLessonDeck(preview,selection as any,template.layout);
    deckIndex[template.id]=deck.map(s=>({kind:s.kind,title:s.title,body:s.body}));
    await exportPpt(preview,path.join(work,template.id+'.pptx'),selection as any,{template});
    for(const [index,slide] of deck.entries()){
      await plate(template.id+'-'+(index+1),<LessonSlideView slide={slide} template={template} projectTitle={preview.title} page={index+1} total={deck.length}/>,
        'body{padding:0;background:white}.ppt-slide-view{box-shadow:none;border-radius:0}');
    }
    if(template.id==='forest')await plate('setup',<LessonSetupView groups={[{id:'reading',title:'放学以后',chosen:true,questions:items.map(([n])=>({id:'q'+n,number:n,selected:n==='8',reason:null})),modules:[{id:'source',name:'英文原文',selected:true,reason:null},{id:'analysis',name:'逐题解析',selected:true,reason:null}]}]} pages={deck.length} issues={[]} busy={false} template={template} onTemplate={noop} onTemplatePending={noop} toggleGroup={noop} toggleQuestion={noop} toggleModule={noop} onPresent={noop} onExport={noop} onBack={noop}/>);
  }
  await fs.writeFile(path.join(work,'deck.json'),JSON.stringify(deckIndex,null,2));
  console.log(made.bundle, Object.fromEntries(Object.entries(deckIndex).map(([k,v])=>[k,(v as any[]).length])));
}
main().catch(e=>{console.error(e);process.exitCode=1});
