import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const profile=path.resolve('.tools/notebook-qa-'+Date.now());await fs.mkdir('test-results',{recursive:true});
const launch=()=>electron.launch({executablePath:process.env.NOTEBOOK_APP||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(process.env.NOTEBOOK_APP?[]:['.']),'--user-data-dir='+profile]});
let app=await launch();const errors=[];
try{
 if(process.env.NOTEBOOK_APP)assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.16.0');
 let page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.setViewportSize({width:1366,height:768});
 await page.getByRole('button',{name:/国家公园 · 英语讲题示例/}).first().click();
 const select=page.getByLabel('选择要收录的题目');await select.selectOption({index:1});await page.getByRole('button',{name:'收录整题',exact:true}).click();await page.getByRole('status').filter({hasText:'已保存到错题本'}).waitFor();
 let rows=await page.evaluate(()=>window.desk.invoke('notebook-list'));assert.equal(rows.length,1);assert.ok(rows[0].context.length>20);
 await page.getByRole('button',{name:'打开错题本',exact:true}).click();await page.getByRole('heading',{name:'错题本 · 1 条'}).waitFor();await page.getByRole('button',{name:'收起错题本'}).click();
 const para=page.locator('.q-card>p').first();await para.waitFor();const original=await para.innerText();await para.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
 await page.getByRole('button',{name:/收录选中文字/}).click();await page.getByRole('status').filter({hasText:'已保存到错题本'}).waitFor();rows=await page.evaluate(()=>window.desk.invoke('notebook-list'));assert.equal(rows.length,2);assert.equal(rows[0].text,original);assert.ok(rows[0].sourceRef?.questionId);const current=await page.evaluate(id=>window.desk.invoke('notebook-source',id),rows[0].id);assert.equal(current.selectionFound,true);
 await page.getByRole('button',{name:'撤销本次收录'}).click();await page.getByRole('status').filter({hasText:'已撤销'}).waitFor();assert.equal((await page.evaluate(()=>window.desk.invoke('notebook-list'))).length,1);
 await page.getByRole('button',{name:'开始授课',exact:true}).click();await page.locator('.lesson-setup-actions .primary').click();await page.locator('.ppt-slide-view').waitFor();
 assert.ok(await page.getByRole('button',{name:/收录选中文字/}).isDisabled(),'切换授课页面后仍残留上页选区');
 const nav=await page.locator('.slide-nav').boundingBox(),bar=await page.locator('.notebook-tools').boundingBox();console.log('layout',JSON.stringify({nav,bar}));assert.ok(nav.y+nav.height<=bar.y,'收录栏遮挡翻页按钮');
 await page.screenshot({path:'test-results/notebook-show.png'});
 await app.close();app=await launch();page=await app.firstWindow();await page.getByRole('button',{name:'打开错题本',exact:true}).click();await page.getByRole('heading',{name:'错题本 · 1 条'}).waitFor();await page.screenshot({path:'test-results/notebook-restart.png'});

 await page.getByRole('button',{name:'收起错题本'}).click();
 await page.evaluate(async()=>{const p=await window.desk.invoke('create','错题本语文测试','chinese');p.chinese={groups:[{id:'g',section:'阅读',title:'测试材料组',kind:'information',materials:[{id:'m',title:'测试材料',text:'观点需要证据支撑。',sourceId:'',blockIds:[]}],questions:[{id:'q',number:'1',stem:'观点与证据是什么关系？',format:'short',materialIds:['m'],answer:'观点需要证据支撑。',confirmed:true}],versions:[]}]};await window.desk.invoke('save',p);});
 await page.reload();await page.getByRole('button',{name:/错题本语文测试/}).first().click();await page.getByLabel('选择要收录的题目').selectOption('q');await page.getByRole('button',{name:'收录整题',exact:true}).click();await page.getByRole('status').filter({hasText:'已保存到错题本'}).waitFor();
 rows=await page.evaluate(()=>window.desk.invoke('notebook-list'));assert.equal(rows[0].subject,'chinese');assert.ok(rows[0].context.includes('观点需要证据支撑'));
 await page.getByRole('button',{name:'备课讲义',exact:true}).click();const zh=page.locator('.zh-original p').first();await zh.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});await page.getByRole('button',{name:/收录选中文字/}).click();await page.getByRole('status').filter({hasText:'已保存到错题本'}).waitFor();
 rows=await page.evaluate(()=>window.desk.invoke('notebook-list'));assert.equal(rows[0].text,'观点需要证据支撑。');assert.equal(rows[0].sourceRef.groupId,'g');assert.equal((await page.evaluate(id=>window.desk.invoke('notebook-source',id),rows[0].id)).selectionFound,true);assert.equal(rows.length,3);
 await page.getByRole('button',{name:'编排授课 / PPT',exact:true}).click();await page.getByRole('button',{name:'开始授课',exact:true}).click();await page.locator('.ppt-slide-view').waitFor();assert.ok(await page.getByRole('button',{name:/收录选中文字/}).isDisabled());
 await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:1366,height:768});
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>window.scrollTo(0,0));const n=await page.locator('.slide-nav').boundingBox(),b=await page.locator('.notebook-tools').boundingBox();assert.ok(n.y+n.height<=b.y,'语文翻页按钮遮挡');assert.ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'水平溢出');}
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:'test-results/notebook-chinese.png'});
 const book=path.join(profile,'notebook.json'),backup=book+'.qa-backup';await fs.rename(book,backup);await fs.mkdir(book);try{await page.getByRole('button',{name:'收录整题',exact:true}).click();await page.getByRole('status').filter({hasText:'操作失败'}).waitFor();assert.ok(!(await page.locator('.notebook-tools').innerText()).includes('已保存到错题本'));}finally{await fs.rmdir(book);await fs.rename(backup,book);}
 assert.deepEqual(errors,[]);console.log('NOTEBOOK QA PASS',profile);
}finally{await app.close();}
