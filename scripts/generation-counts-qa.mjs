import {_electron as electron} from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
const profile=path.resolve('.tools/counts-qa-'+Date.now());
const launch=()=>electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+profile]});
let app=await launch();
try{
 let page=await app.firstWindow();await page.waitForSelector('.project-row');
 await page.evaluate(()=>window.desk.invoke('save-settings',{provider:'deepseek',model:'count-test',baseUrl:'https://api.deepseek.com',key:'synthetic-test-only'}));
 const before=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));
 await page.reload();await page.getByRole('button',{name:'连接设置',exact:true}).click();
 await page.getByLabel('句法拆解句子数',{exact:true}).selectOption('1');await page.getByLabel('词汇手账词条数',{exact:true}).selectOption('12');await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await page.waitForFunction(async()=>{const s=await window.desk.invoke('settings');return s.sentenceCount===1&&s.lexiconCount===12;});
 const after=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));if(before.encryptedKey!==after.encryptedKey||after.model!=='count-test')throw Error('保存数量影响API配置');
 await page.setViewportSize({width:1366,height:768});await page.getByLabel('词汇手账词条数',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/generation-counts.png'});
 await app.close();app=await launch();page=await app.firstWindow();await page.waitForSelector('.project-row');await page.getByRole('button',{name:'连接设置',exact:true}).click();
 if(await page.getByLabel('句法拆解句子数',{exact:true}).inputValue()!=='1'||await page.getByLabel('词汇手账词条数',{exact:true}).inputValue()!=='12')throw Error('重启丢失数量');
 await page.getByLabel('句法拆解句子数',{exact:true}).selectOption('0');await page.getByLabel('词汇手账词条数',{exact:true}).selectOption('0');await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await page.waitForFunction(async()=>{const s=await window.desk.invoke('settings');return s.sentenceCount===0&&s.lexiconCount===0;});
 await fs.writeFile('test-results/generation-counts-qa.json',JSON.stringify({version:await app.evaluate(({app})=>app.getVersion()),packaged:!!process.env.QA_PACKAGED,checks:['选择数量','保存生效','凭据和模型不变','重启保留','切回自动']},null,2));console.log('GENERATION COUNTS QA PASS');
}finally{await app.close();}
