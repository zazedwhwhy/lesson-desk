import {_electron as electron} from 'playwright';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
await build({entryPoints:['src/core/teaching-demo.ts'],outfile:'.tools/prompt-fixtures.cjs',bundle:true,platform:'node',format:'cjs'});
const {demoGeneratedPart}=createRequire(import.meta.url)('../.tools/prompt-fixtures.cjs');
const profile=path.resolve('.tools/prompt-qa-'+Date.now());
const launch=()=>electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+profile]});
let app=await launch();const errors=[];
try{
 let page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.waitForSelector('.project-row');
 await page.getByRole('button',{name:'连接设置',exact:true}).click();await page.getByRole('button',{name:'查看与编辑提示词',exact:true}).click();
 const taskSelect=page.getByLabel('任务',{exact:true});await page.waitForFunction(()=>document.querySelectorAll('.prompt-settings select option').length===20);
 const allTasks=await taskSelect.locator('option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,title:n.textContent})));
 if(allTasks.length!==20)throw Error('模板列表数量错误');
 for(const item of allTasks){await taskSelect.selectOption(item.id);if(!(await page.getByLabel('任务要求',{exact:true}).inputValue()).trim())throw Error('空模板：'+item.title);}
 await taskSelect.selectOption('structure');const structure=await page.getByLabel('任务要求',{exact:true}).inputValue();await page.getByLabel('任务要求',{exact:true}).fill(structure+'\n篇章自定义测试。');await page.getByRole('button',{name:'保存提示词',exact:true}).click();await page.getByRole('status').filter({hasText:'已保存'}).waitFor();
 const stored=await page.evaluate(()=>window.desk.invoke('prompts'));if(!stored.find(e=>e.id==='structure').effective.instruction.includes('篇章自定义测试'))throw Error('非句法词汇模板未保存');
 await taskSelect.selectOption('sentences');
 const input=page.getByLabel('任务要求',{exact:true});await input.waitFor();const original=await input.inputValue();if(!original.includes('浙江'))throw Error('缺少浙江默认范围');
 await input.fill(original+'\n测试定制：针对高一学生讲解。');await page.getByRole('button',{name:'保存提示词',exact:true}).click();await page.getByRole('status').filter({hasText:'已保存'}).waitFor();
 await page.evaluate(()=>window.desk.invoke('save-settings',{provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'mock',key:'synthetic-only'}));
 await app.evaluate(({Notification},raw)=>{Notification.prototype.show=function(){};globalThis.fetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});},demoGeneratedPart('sentences'));
 await page.evaluate(async()=>{const rows=await window.desk.invoke('list'),p=await window.desk.invoke('load',rows[0].id);await window.desk.invoke('teaching',p.id,p.passages[0].id,'sentences');});
 await page.getByRole('button',{name:'返回模型设置',exact:true}).click();await page.getByRole('button',{name:'查看与编辑提示词',exact:true}).click();
 await page.getByText('最近一次组装的 API 请求（不代表调用成功）',{exact:true}).click();const preview=await page.locator('.prompt-preview').innerText();if(!preview.includes('针对高一')||!preview.includes('tokenizedSentences')||preview.includes('synthetic-only'))throw Error('实际请求不匹配或含凭据');
 const sizes=[];for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.screenshot({path:'test-results/prompt-settings-'+size.width+'.png'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 await app.close();app=await launch();page=await app.firstWindow();await page.waitForSelector('.project-row');await page.getByRole('button',{name:'连接设置',exact:true}).click();await page.getByRole('button',{name:'查看与编辑提示词',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('textarea')?.value.includes('针对高一'));if(await page.locator('.prompt-preview').count())throw Error('重启后不应保留材料请求预览');
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'恢复默认',exact:true}).click();await page.getByRole('status').filter({hasText:'已恢复'}).waitFor();if((await page.getByLabel('任务要求',{exact:true}).inputValue()).includes('针对高一'))throw Error('未恢复默认');
 const settings=await page.evaluate(()=>window.desk.invoke('settings'));if(settings.model!=='mock'||!settings.hasKey)throw Error('提示词修改影响模型配置');
 if(errors.length||sizes.some(s=>s.overflow))throw Error(JSON.stringify({errors,sizes}));
 await fs.writeFile('test-results/prompt-settings-qa.json',JSON.stringify({version:await app.evaluate(({app})=>app.getVersion()),packaged:!!process.env.QA_PACKAGED,errors,sizes,checks:['浙江范围','编辑保存','实际请求使用自定义要求并保留材料','预览不含凭据','重启保存','请求材料不落盘','恢复默认','模型凭据保留']},null,2));console.log('PROMPT SETTINGS QA PASS');
}finally{await app.close();}
