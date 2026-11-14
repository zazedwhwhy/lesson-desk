// Isolated synthetic QA: no user profile, credentials, or network requests.
import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {zipSync, unzipSync, strToU8, strFromU8} from 'fflate';
import pptxgen from 'pptxgenjs';

const out=path.resolve(process.env.QA_OUTPUT_DIR||'test-results/chinese-shared-workflow');
await fs.mkdir(out,{recursive:true});
const profile=path.join(out,'profile-'+Date.now());
const docx=path.join(out,'synthetic.docx'), template=path.join(out,'synthetic-template.pptx');
const xml=s=>strToU8(s);
await fs.writeFile(docx,zipSync({
 '[Content_Types].xml':xml('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
 '_rels/.rels':xml('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
 'word/document.xml':xml('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>合成试卷：观点需要证据支撑。</w:t></w:r></w:p></w:body></w:document>')
}));
const pres=new pptxgen();pres.addSlide().addText('合成模板');await pres.writeFile({fileName:template});
const app=await electron.launch({args:['.','--user-data-dir='+profile],timeout:60000});
const checks=[], errors=[];let stage='启动';
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await app.evaluate(({Notification})=>{Notification.prototype.show=function(){};globalThis.__calls=[];globalThis.__slow=false;globalThis.fetch=async(_url,init)=>{if(globalThis.__slow)await new Promise((resolve,reject)=>{const t=setTimeout(resolve,5000);const stop=()=>{clearTimeout(t);reject(new DOMException('Synthetic cancellation','AbortError'));};if(init.signal?.aborted)stop();else init.signal?.addEventListener('abort',stop,{once:true});});const text=JSON.parse(init.body).messages[1].content;const input=JSON.parse(text.split('\n输入：')[1].split('\n输出必须')[0]);globalThis.__calls.push({title:input.title,questions:input.questions.map(q=>q.id)});return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({status:'ok',notices:['合成响应'],blocks:[{label:'解题观察',text:'先找到观点需要证据支撑。',evidence:[{materialId:'m',quote:'观点需要证据支撑。'}]},{label:'参考作答',text:'观点须有事实依据。',evidence:[]}]})}}]});};});
 const shot=async name=>page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
 const mark=s=>{stage=s;checks.push(s);console.log('PASS '+s);};
 const button=(name)=>page.getByRole('button',{name,exact:true});
 await page.setViewportSize({width:1366,height:768});
 // Both subjects open the same preparation surface when created.
 for(const subject of ['english','chinese']){
  await page.getByLabel('学科',{exact:true}).selectOption(subject);await page.getByLabel('课件名称').fill('合成验证 '+subject);await button('新建课件').click();
  await page.getByRole('heading',{name:'整理材料，准备本次讲义'}).waitFor();
  await page.getByRole('heading',{name:'原材料',exact:true}).waitFor();
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},docx);
  await button('上传试卷').click();await page.getByLabel('选择原材料').locator('option').filter({hasText:'synthetic.docx'}).waitFor({state:'attached'});
  const value=await page.getByLabel('选择原材料').locator('option').filter({hasText:'synthetic.docx'}).getAttribute('value');await page.getByLabel('选择原材料').selectOption(value);
  await page.getByLabel('原材料段落1').fill('合成导入材料，已由教师编辑。');await page.getByLabel('原材料段落1').blur();
  await page.waitForFunction(async title=>{const rows=await window.desk.invoke('list');const p=await window.desk.invoke('load',rows.find(x=>x.title===title).id);return p.sources.some(s=>s.name==='synthetic.docx'&&s.blocks[0].text==='合成导入材料，已由教师编辑。');},'合成验证 '+subject);
  const paste=page.getByPlaceholder(subject==='english'?'粘贴参考答案、听力原文等':'粘贴试卷、参考答案或补充材料');await paste.fill('合成粘贴答案');await button('作为答案添加').click();await page.getByLabel('选择原材料').locator('option').filter({hasText:'粘贴答案'}).waitFor({state:'attached'});
  await button('上传答案').click();await page.getByLabel('选择原材料').locator('option').filter({hasText:'答案：synthetic.docx'}).waitFor({state:'attached'});
  if(subject==='chinese'){await paste.fill('合成粘贴试卷');await button('作为试卷添加').click();await page.getByLabel('选择原材料').locator('option').filter({hasText:'粘贴试卷'}).waitFor({state:'attached'});}
  await shot(subject+'-materials-1366');mark(subject+' 新建、上传、编辑、粘贴');
  if(subject==='english'){await page.setViewportSize({width:1920,height:1080});await shot('english-materials-1920');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('英语 1920 水平溢出');await page.setViewportSize({width:1366,height:768});await button('课件库').click();await page.locator('.project-row').filter({hasText:'合成验证 english'}).click();await page.getByText('还没有整理好的题目').waitFor();await button('课件库').click();continue;}
 }
 // Seed only synthetic structured questions, then verify opening an existing project enters teaching.
 const id=await page.evaluate(async()=>{const rows=await window.desk.invoke('list');const p=await window.desk.invoke('load',rows.find(x=>x.title==='合成验证 chinese').id);p.chinese={groups:[{id:'g',section:'阅读 I',title:'多材料阅读',kind:'information',materials:[{id:'m',title:'材料一',text:'观点需要证据支撑。',sourceId:'',blockIds:[]}],questions:[{id:'q',number:'1',stem:'说明观点与证据的关系。',format:'short',materialIds:['m'],answer:'观点需要证据支撑。',confirmed:false},{id:'q2',number:'2',stem:'说明事实和推断的区别。',format:'short',materialIds:['m'],answer:'应区分事实与推断。',confirmed:false}],versions:[]}]};await window.desk.invoke('save-settings',{provider:'deepseek',model:'synthetic-qa',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return (await window.desk.invoke('save',p)).id;});
 await button('课件库').click();await page.locator('.project-row').filter({hasText:'合成验证 chinese'}).click();await page.locator('.chinese-classroom').waitFor();mark('已有课件打开至教案');
 await button('整理材料').click();await page.getByRole('region',{name:'批量操作'}).getByLabel('选择整卷').check();await button('核对所选').click();await page.getByText('已处理 2 题',{exact:true}).waitFor();mark('题目批量选择与核对');
 const gen=page.getByRole('region',{name:'生成教学内容'});await gen.getByRole('button',{name:'连接设置'}).click();await page.getByRole('heading',{name:'模型设置'}).waitFor();await button('返回').click();await page.getByRole('heading',{name:'整理材料，准备本次讲义'}).waitFor();mark('设置返回整理材料');
 await page.locator('#prepare-generation').scrollIntoViewIfNeeded();await shot('chinese-generation-1366');
 await app.evaluate(()=>{globalThis.__slow=true;});await gen.getByRole('button',{name:/^开始生成/}).click();await button('取消本次生成').click();await gen.getByRole('button',{name:'继续上次未完成项'}).waitFor({timeout:60000});await app.evaluate(()=>{globalThis.__slow=false;});await button('继续上次未完成项').click();await page.waitForFunction(()=>!document.querySelector('#prepare-generation button')?.disabled,{timeout:60000});
 await page.waitForFunction(async id=>{const p=await window.desk.invoke('load',id);return p.chinese.tasks.length>0&&p.chinese.tasks.every(t=>t.state==='complete');},id,{timeout:60000});let p=await page.evaluate(id=>window.desk.invoke('load',id),id);if(p.chinese.groups[0].versions.some(v=>v.confirmed))throw Error('生成结果被自动确认');mark('生成选择、取消与恢复');
 await button('返回教案').click();await page.locator('.chinese-classroom').waitFor();await button('阅读设置').click();await button('对读').click();await page.getByLabel('分栏宽度').waitFor();await page.getByRole('slider',{name:'字号'}).fill('30');await page.getByRole('button',{name:'关闭阅读设置'}).click();await button('显示答案与讲解').first().click();await button('已核实，确认本版讲义').first().click();await button('取消讲义确认').first().waitFor();await button('参考答案').click();await page.getByText('第 1 题：观点需要证据支撑。',{exact:true}).waitFor();await shot('chinese-teaching-1366');mark('对读、阅读设置、参考答案、版本确认');
 await button('开始授课').click();await page.getByRole('heading',{name:'编排本次讲课'}).waitFor();const group=page.locator('.lesson-group').first();const groupCheck=group.locator('.lesson-passage input');await groupCheck.uncheck();if(await group.locator('.lesson-group-body').count())throw Error('取消材料后选项仍显示');await groupCheck.check();const question=group.locator('fieldset').first().locator('input').first();const beforeQuestion=await question.isChecked();await question.setChecked(!beforeQuestion);if(await question.isChecked()===beforeQuestion)throw Error('题目选择未改变');await question.setChecked(beforeQuestion);const module=group.locator('fieldset').nth(1).locator('input:not(:disabled)').first();const beforeModule=await module.isChecked();await module.setChecked(!beforeModule);if(await module.isChecked()===beforeModule)throw Error('模块选择未改变');await module.setChecked(beforeModule);await page.locator('.ppt-picker input[type=radio]').nth(1).check();await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},template);await button('上传 PPT 模板').click();await page.locator('.ppt-custom-preview').waitFor();await shot('chinese-arrange-1366');mark('共享编排、模板选择及上传预览');
 await page.locator('.lesson-setup-actions').getByRole('button',{name:'开始授课'}).click();await page.getByLabel('跳转页面').waitFor();const slides=await page.getByLabel('跳转页面').locator('option').allTextContents();if(slides.length<3||!slides[0].includes('材料')||!slides[1].includes('第 1 题')||!slides[2].includes('逐题讲评'))throw Error('放映页序异常：'+slides.join(' / '));await page.getByLabel('跳转页面').selectOption('1');await shot('chinese-present-1366');await button('返回编排').click();mark('放映及页序');
 const ppt=path.join(out,'chinese.pptx');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},ppt);await button('输出可编辑 PPT').click();await page.getByText(/已导出 \d+ 页可编辑课件/).waitFor();const archive=unzipSync(new Uint8Array(await fs.readFile(ppt)));const slideXml=Object.entries(archive).filter(([n])=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(([,v])=>strFromU8(v)).join('');if(!slideXml.includes('观点需要证据支撑')||!slideXml.includes('先找到'))throw Error('PPT 缺材料或讲义');mark('实际导出 PPT');
 await button('返回教案').click();await button('整理材料').click();const bundle=path.join(out,'chinese.lesson.zip');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},bundle);await button('导出备份课件包').click();await page.getByText('备份课件包已导出，可重新导入工作台继续备课。').waitFor();const z=unzipSync(new Uint8Array(await fs.readFile(bundle)));p=JSON.parse(strFromU8(z['project.json']));if(p.id!==id||strFromU8(z['project.json']).includes('synthetic-test-credential')||!p.chinese.groups[0].versions.some(v=>v.confirmed))throw Error('备份内容异常或未保存确认');mark('实际备份并核验');
 await page.setViewportSize({width:1920,height:1080});await shot('chinese-review-1920');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('1920 水平溢出');if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({result:'PASS',checks,slides,profile,errors},null,2));console.log('CHINESE SHARED WORKFLOW PASS');
}catch(e){await fs.writeFile(path.join(out,'result.json'),JSON.stringify({result:'FAIL',stage,error:String(e),checks,profile,errors},null,2));throw e;}finally{await app.close();}
