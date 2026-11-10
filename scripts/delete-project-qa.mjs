import{_electron as electron}from'playwright';
import fs from'node:fs/promises';
import path from'node:path';
const profile=path.resolve('.tools/delete-qa-'+Date.now()),recovery=path.join(profile,'test-recovery');
const launch=()=>electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+profile]});
await fs.mkdir(recovery,{recursive:true});let app=await launch();
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.waitForSelector('.project-row');
 const fixture=await page.evaluate(async()=>{const p=await window.desk.invoke('create','删除按钮测试课件');await window.desk.invoke('create','保留的测试课件');return p;});await page.reload();await page.waitForSelector('.project-row');
 await app.evaluate(({dialog,shell},{recovery})=>{const original=shell.trashItem;globalThis.__deleteMode='cancel';globalThis.__deleteDialogs=[];globalThis.__realTrash=0;dialog.showMessageBox=async(_win,options)=>{globalThis.__deleteDialogs.push(options);return{response:globalThis.__deleteMode==='cancel'?0:1,checkboxChecked:false};};shell.trashItem=async directory=>{if(globalThis.__deleteMode==='fail')throw Error('测试：回收站不可用');if(globalThis.__deleteMode==='real'){await original.call(shell,directory);globalThis.__realTrash++;return;}const fs=process.getBuiltinModule('fs').promises,path=process.getBuiltinModule('path');await fs.rename(directory,path.join(recovery,path.basename(directory)));};},{recovery});
 const target=page.getByRole('button',{name:'删除课件：删除按钮测试课件',exact:true});
 await target.click();await page.waitForFunction(()=>!document.querySelector('.busy'));if(await target.count()!==1||!await page.locator('.home').count())throw Error('取消删除丢失课件或误触打开');
 await app.evaluate(()=>{globalThis.__deleteMode='fail';});await target.click();await page.getByRole('status').filter({hasText:'回收站不可用'}).waitFor();if(await target.count()!==1)throw Error('删除失败却移除课件列表');await fs.access(path.join(profile,'projects',fixture.id,'project.json'));
 await app.evaluate(()=>{globalThis.__deleteMode='real';});await target.click();await page.getByRole('status').filter({hasText:'课件已移到系统回收站'}).waitFor();if(await target.count())throw Error('成功删除后列表未刷新');
 if(!await page.getByRole('button',{name:'删除课件：保留的测试课件',exact:true}).count())throw Error('误删了其他课件');
 const invalid=await page.evaluate(()=>window.desk.invoke('delete-project','../outside').then(()=>false,e=>String(e).includes('课件ID')));if(!invalid)throw Error('未阻断目录穿越');
 const dialogs=await app.evaluate(()=>globalThis.__deleteDialogs),realTrash=await app.evaluate(()=>globalThis.__realTrash);if(realTrash!==1||dialogs.some(d=>d.defaultId!==0||d.cancelId!==0||!d.message.includes('删除按钮测试课件')))throw Error('确认名称、默认取消或系统回收站行为错误');
 const sizes=[];for(const size of[{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.screenshot({path:'test-results/delete-home-'+size.width+'.png',animations:'disabled'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 await app.evaluate(()=>{globalThis.__deleteMode='accept';});const remaining=await page.evaluate(()=>window.desk.invoke('list'));for(const p of remaining)await page.getByRole('button',{name:'删除课件：'+p.title,exact:true}).click();await page.getByText('还没有课件，可以新建课件或导入课件包。',{exact:true}).waitFor();
 const version=await app.evaluate(({app})=>app.getVersion());await app.close();app=await launch();const restarted=await app.firstWindow();await restarted.getByText('还没有课件，可以新建课件或导入课件包。',{exact:true}).waitFor();if(await restarted.locator('.project-row').count())throw Error('重启后重新创建已删除课件');
 if(errors.length||sizes.some(s=>s.overflow))throw Error(JSON.stringify({errors,sizes}));
 await fs.writeFile('test-results/delete-project-qa.json',JSON.stringify({version,packaged:!!process.env.QA_PACKAGED,errors,sizes,realTrash,checks:['按钮独立于打开课件','确认显示课件名称且默认取消','取消后保留课件','回收站失败不永久删除','一份隔离课件实际移入系统回收站','其他课件保留','目录穿越阻断','删除后刷新列表','空列表重启后不复建示例'],profile},null,2));console.log('DELETE PROJECT QA PASS');
}finally{await app.close();}
