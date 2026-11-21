import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const work=fileURLToPath(new URL('work/',import.meta.url)),file=path.join(work,'film-ui.html');
const cssDir='src/ui',styles=await Promise.all(['style','chemistry','ppt-templates'].map(n=>fs.readFile(cssDir+'/'+n+'.css','utf8')));
const chart=await fs.readFile(path.join(work,'original-chart.png'));
await fs.writeFile(file,'<!doctype html><meta charset=utf-8><style>'+styles.join('\n')+' body{margin:0}.classroom{height:calc(100vh - 48px)}.ppt-slide-view{position:relative;margin:0;width:1200px!important;height:675px!important;box-sizing:border-box;box-shadow:none}.chem-notes textarea{min-height:48px} </style><div id=root></div><script>window.image="data:image/png;base64,'+chart.toString('base64')+'"</script><script src="film-ui.js"></script>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const tab=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1.6});
 tab.on('pageerror',e=>console.error(e));
 await tab.goto(pathToFileURL(file).href);await tab.locator('.chem-question > summary').click();
 const shot=async name=>{await tab.evaluate(()=>document.fonts.ready);await tab.screenshot({path:path.join(work,name+'.png')})};
 const figure=tab.locator('.chem-figures').first();await figure.locator('img').waitFor({state:'attached'});
 await tab.addStyleTag({content:'.review{max-width:980px;margin:auto}.review .chem-figures img{width:auto;max-height:330px}.review .chem-figures figure{margin:0}.review .chem-figures figcaption{font-size:18px}'});
 await figure.evaluate(el=>el.scrollIntoView({block:'start'}));await shot('review');
 await tab.evaluate(()=>window.selectView('edit'));await tab.getByRole('button',{name:'切换题目目录'}).click();
 await tab.getByRole('button',{name:'显示答案与讲解'}).click();
 await tab.getByText('修改讲解与版本',{exact:true}).click();
 const input=tab.locator('.chem-notes textarea').first();await input.focus();
 await input.evaluate(el=>el.scrollIntoView({block:'center'}));await shot('edit-0');
 const copy='先找 20 ℃，再比纵坐标。';
 for(let i=1;i<=copy.length;i++){await input.fill(copy.slice(0,i));await shot('edit-'+i)}
 await tab.getByRole('button',{name:'另存教师修订版'}).click();
 const confirm=tab.getByRole('button',{name:'已核实，确认本版讲义'});await confirm.click();
 await tab.getByText('教师已确认',{exact:true}).waitFor();await tab.locator('.chem-notes').evaluate(el=>el.scrollIntoView({block:'center'}));await shot('confirmed');
 await tab.evaluate(()=>window.selectView('show'));
 await tab.locator('.ppt-slide-view').waitFor();
 for(const i of [1,2,3]){await tab.evaluate(i=>window.setSlide(i),i);await tab.waitForTimeout(80);await shot('show-'+i)}
 const deck=await tab.evaluate(()=>window.slides);
 if(deck.length!==3||!deck[2].blocks.some(b=>b.text===copy))throw Error('修订没有进入放映');
 await fs.writeFile(path.join(work,'film-deck.json'),JSON.stringify(deck));
}finally{await browser.close()}
