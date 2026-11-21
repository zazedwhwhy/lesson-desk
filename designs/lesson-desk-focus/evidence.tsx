import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chemQuestionSchema,chemSlides} from '../../src/core/chemistry';
import {builtinPptTemplates} from '../../src/core/ppt-templates';
import {exportLessonSlides} from '../../src/desktop/export';
import {LessonSlideView} from '../../src/ui/LessonSlideView';

async function main(){
 const dir=path.resolve('designs/lesson-desk-focus'),work=path.join(dir,'work');
 const data='data:image/png;base64,'+(await fs.readFile(path.join(work,'original-chart.png'))).toString('base64');
 const question=chemQuestionSchema.parse({id:'q12',number:'12',stage:'junior',kind:'principle',stem:'20 ℃ 时，哪种物质的溶解度更大？',answer:'B',confirmed:true,sourceId:'test-paper',pages:[1],images:[{id:'graph',name:'溶解度曲线',data,sourceId:'test-paper',page:1,description:'20 ℃ 时 B 曲线高于 A，40 ℃ 时相交。',confirmed:true}]});
 const template=builtinPptTemplates[0],deck=chemSlides({questions:[question]} as any,['question:q12'],template.layout);
 if(deck.length!==2||deck[1].image!==data)throw Error('原图未进入实际授课页');
 await exportLessonSlides(deck,'溶解度曲线','chemistry',path.join(work,'课堂输出.pptx'),{template});
 const css=await fs.readFile('src/ui/ppt-templates.css','utf8');
 const page=renderToStaticMarkup(<LessonSlideView slide={deck[1]} template={template} projectTitle="溶解度曲线" page={2} total={2} chinese/>);
 const file=path.join(work,'product.html');
 await fs.writeFile(file,'<!doctype html><meta charset="utf-8"><style>'+css+'body{margin:0}.ppt-slide-view{position:relative;margin:0;width:1200px!important;height:675px!important;box-sizing:border-box;box-shadow:none}</style>'+page);
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const tab=await browser.newPage({viewport:{width:1200,height:675}});await tab.goto(pathToFileURL(file).href);await tab.screenshot({path:path.join(dir,'actual-classroom.jpg'),quality:92})}finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
