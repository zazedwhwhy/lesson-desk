import {_electron as electron} from 'playwright';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

// Browser plugin not available; Electron's existing Playwright workflow is used.
// Flow: open lesson -> generate each module -> inspect evidence / recall -> edit / reload.
await build({entryPoints:['src/core/teaching-demo.ts','src/core/exercise-demo.ts'],outdir:'.tools/quality-0.11-fixtures',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'}});
const require=createRequire(import.meta.url),{demoGeneratedPart}=require('../.tools/quality-0.11-fixtures/teaching-demo.cjs'),{demoExercise}=require('../.tools/quality-0.11-fixtures/exercise-demo.cjs');
const profile=path.resolve('.tools/quality-ui-'+Date.now());
const app=await electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+profile]});
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.waitForSelector('.project-row');
 const p=await page.evaluate(async()=>{const rows=await window.desk.invoke('list'),p=await window.desk.invoke('load',rows[0].id);p.title='教学质量 0.11 回归';delete p.passages[0].learning;await window.desk.invoke('save',p);await window.desk.invoke('save-settings',{provider:'deepseek',model:'mock',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return p;});
 await app.evaluate((_electron,fixtures)=>{
  globalThis.__fixtures=fixtures;globalThis.__calls=[];globalThis.__reject=false;
  _electron.Notification.prototype.show=function(){};
  globalThis.fetch=async(_url,init)=>{
   const text=JSON.parse(init.body).messages[1].content;let raw;
   if(text.startsWith('教学内容复核：')){globalThis.__calls.push('review');raw={issues:globalThis.__reject?[{location:'candidate',problem:'模拟明确教学错误',suggestion:'重新核对原文依据'}]:[]};}
   else if(text.includes('本次仅生成')){const module=text.match(/本次仅生成(\w+)字段/)[1];globalThis.__calls.push(module);raw=structuredClone(globalThis.__fixtures.parts[module]);}
   else if(text.includes('仅提炼此题')){raw={kind:'reading',skill:globalThis.__fixtures.exercise.skill,sourceTopic:'National parks'};}
   else if(text.includes('独立练习任务：')){const input=JSON.parse(text.split('独立练习任务：\n')[1].split('\n输出必须')[0].split('\n上次此练习')[0]);globalThis.__calls.push('practice');raw={items:input.map(t=>({id:t.id,exercise:{...globalThis.__fixtures.exercise,kind:t.kind,skill:t.skill,newTopic:t.newTopic}}))};}
   else throw Error('Unexpected request');
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});
  };
 },{parts:Object.fromEntries(['structure','lexicon'].map(m=>[m,demoGeneratedPart(m,p.questions)])),exercise:demoExercise()});
 await page.reload();await page.locator('.project-row').filter({hasText:p.title}).click();
 const select=async name=>page.locator('.section-tabs').getByRole('button',{name,exact:true}).click();
 const generate=async name=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForSelector('.busy',{state:'hidden'});};
 await select('篇章脉络');await generate('生成篇章脉络');
 if(!await page.locator('.structure-question').count())throw Error('缺少真实题号与解题方法');
 await page.getByText('查看原文依据',{exact:true}).click();if(!(await page.locator('.structure-evidence').innerText()).includes('Great Smoky Mountains'))throw Error('缺少原文证据');
 const sizes=[];
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>{window.scrollTo(0,0);const pane=document.querySelector('.explanations');pane.scrollTop=pane.querySelector('.outline').offsetTop-pane.offsetTop-40;});await page.screenshot({path:'test-results/quality-structure-'+size.width+'.png'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 await select('词汇手账');await generate('生成词汇手账');
 if(!await page.getByText('本句用法',{exact:true}).count()||!await page.getByText('例句译文',{exact:true}).count())throw Error('词汇教学字段缺失');
 await page.getByRole('button',{name:'切换回忆模式',exact:true}).click();
 await page.waitForSelector('.recall-source-note');
 const first=page.locator('.word-entry').first(),visible=await first.innerText();if(visible.includes('variety'))throw Error('回忆模式泄露词头或原句：'+visible);
 if((await page.locator('.reading').innerText()).includes('variety'))throw Error('回忆模式仍能在左栏原文看到答案');
 await page.getByLabel('词条 1 的回忆',{exact:true}).fill('variety');await first.locator('h3').first().click();
 await page.waitForFunction(()=>!document.querySelector('.busy'));
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>{window.scrollTo(0,0);const pane=document.querySelector('.explanations');pane.scrollTop=pane.querySelector('.word-entry').offsetTop-pane.offsetTop-40;});await page.screenshot({path:'test-results/quality-recall-'+size.width+'.png'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 await first.getByText('核对答案',{exact:true}).click();if(!(await first.innerText()).includes('variety'))throw Error('无法揭示回忆答案');
 await select('篇章脉络');if(!(await page.locator('.reading').innerText()).includes('variety'))throw Error('离开回忆模式后原文未恢复');await select('词汇手账');if(!await page.getByRole('button',{name:'切换回忆模式',exact:true}).isVisible())throw Error('切换模块未重置回忆模式');
 await page.getByRole('button',{name:'修订讲义',exact:true}).click();const meaning=page.getByLabel('本篇义',{exact:true}).first();await meaning.fill('多样性（教师核对）');await page.getByLabel('搭配',{exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.word-entry')?.textContent?.includes('多样性（教师核对）'));
 if(!await page.getByRole('button',{name:'结束修订',exact:true}).isVisible())throw Error('保存一个字段后修订模式意外退出');
 await page.getByRole('button',{name:'结束修订',exact:true}).click();
 await page.getByRole('button',{name:'切换回忆模式',exact:true}).click();if(await page.getByLabel('词条 1 的回忆',{exact:true}).inputValue()!=='variety')throw Error('教师修订丢失回忆草稿');
 await page.locator('.word-entry').first().getByText('核对答案',{exact:true}).click();if(!(await page.locator('.word-entry').first().innerText()).includes('多样性（教师核对）'))throw Error('教师改词义后回忆答案未同步');
 await select('考点演练');await generate('生成考点演练');if(await page.locator('.generated-exercise').count()!==1)throw Error('未生成练习');
 if(await page.locator('.generated-exercise .answer-fold').evaluate(d=>d.open))throw Error('答案提前展开');
 const before=await page.evaluate(id=>window.desk.invoke('load',id),p.id);
 await app.evaluate(()=>{globalThis.__reject=true;});await select('词汇手账');await generate('重新生成词汇手账');
 const after=await page.evaluate(id=>window.desk.invoke('load',id),p.id);
 if(JSON.stringify(before.passages[0].learning)!==JSON.stringify(after.passages[0].learning))throw Error('复核失败覆盖历史讲义');
 if(after.job.state!=='failed'||!JSON.stringify(after.job.errors).includes('复核'))throw Error('复核失败未明确显示');
 if(errors.length||sizes.some(s=>s.overflow))throw Error(JSON.stringify({errors,sizes}));
 await fs.writeFile('test-results/quality-modules-qa.json',JSON.stringify({version:await app.evaluate(({app})=>app.getVersion()),packaged:!!process.env.QA_PACKAGED,browser:'Browser plugin not available; existing Electron Playwright workflow',errors,sizes,checks:['板块原文依据','逐题定位方法','词形和语境用法','回忆模式隐藏答案','草稿保留','教师词义同步回忆答案','修订模式持续','考点演练独立复核','答案默认折叠','复核失败有限修正并保留旧版'],profile},null,2));
 console.log('QUALITY MODULES QA PASS');
}finally{await app.close();}
