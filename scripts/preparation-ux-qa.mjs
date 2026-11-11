// Run only by the computer_use agent. Real user data and network requests are not used.
// Adapted from selected-generation-qa.mjs and chinese-qa.mjs.
import {_electron as electron} from 'playwright';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
const out=path.resolve(process.env.QA_OUTPUT_DIR||'test-results/preparation-ux');
const executable=process.env.QA_EXECUTABLE?path.resolve(process.env.QA_EXECUTABLE):process.env.QA_PACKAGED?path.resolve('release/win-unpacked/讲题工作台.exe'):undefined;
const launchOptions=profile=>({... (executable?{executablePath:executable}:{}),args:[...(executable?[]:['.']),'--user-data-dir='+profile],timeout:60000});
await fs.mkdir(out,{recursive:true});
const results=[];
async function shot(page,locator,name){await locator.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function finished(page){await page.waitForFunction(()=>document.querySelector('#prepare-generation .actions .primary')?.disabled===false,{},{timeout:60000});}
async function verifyBundle(file,id){const zip=unzipSync(new Uint8Array(await fs.readFile(file)));if(!zip['project.json'])throw Error('备份缺 project.json');const p=JSON.parse(strFromU8(zip['project.json']));if(p.id!==id)throw Error('备份不是当前课件');if(Object.keys(zip).some(n=>/settings|credential|auth/i.test(n))||strFromU8(zip['project.json']).includes('synthetic-test-credential'))throw Error('备份包含模拟凭据');return p;}
async function englishChecks(){
await build({entryPoints:['src/core/teaching-demo.ts','src/core/exercise-demo.ts'],outdir:'.tools/generation-qa-fixture',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'}});
const require=createRequire(import.meta.url),{demoGeneratedPart}=require('../.tools/generation-qa-fixture/teaching-demo.cjs'),{demoExercise}=require('../.tools/generation-qa-fixture/exercise-demo.cjs');
const profile=path.resolve('.tools/preparation-english-'+Date.now()),app=await electron.launch(launchOptions(profile));
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.waitForSelector('.project-row');
 const fixture=await page.evaluate(async()=>{const rows=await window.desk.invoke('list'),p=await window.desk.invoke('load',rows[0].id);p.title='备课流程 · 合成英语验证';p.example=false;delete p.passages[0].learning;delete p.passages[0].special;p.passages[0].translation='';p.questions[0].versions=[];delete p.questions[0].activeVersion;const second=structuredClone(p.passages[0]);second.id='second';second.title='阅读B';p.passages.push(second);p.questions.push({...structuredClone(p.questions[0]),id:'q22',number:'22'},{...structuredClone(p.questions[0]),id:'q24',number:'24',passageId:'second'});await window.desk.invoke('save',p);await window.desk.invoke('save-settings',{provider:'deepseek',model:'synthetic-qa',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return p;});
 await app.evaluate((_electron,fixture)=>{globalThis.__parts=fixture.parts;globalThis.__exercise=fixture.exercise;globalThis.__failSyntax=true;globalThis.__calls=[];globalThis.__notifications=[];_electron.Notification.prototype.show=function(){globalThis.__notifications.push({title:this.title,body:this.body});globalThis.__lastNotification=this;};globalThis.fetch=async(_url,init)=>{const text=JSON.parse(init.body).messages[1].content;let raw;
 if(text.includes('仅生成原题解析')){const input=JSON.parse(text.split('\n输入：')[1].split('\n输出必须')[0]);globalThis.__calls.push('analysis');if(globalThis.__badJson){globalThis.__badJson=false;return Response.json({choices:[{finish_reason:'stop',message:{content:'{broken'}}]});}raw={explanations:input.questions.map(q=>({questionId:q.id,answer:q.referenceAnswer,analysis:'原文的动植物多样性对应biodiversity。',evidenceIds:['C1'],practiceBlueprint:{kind:q.type,skill:globalThis.__exercise.skill,sourceTopic:'National parks'}}))};}
 else if(text.includes('仅提炼此题')){globalThis.__calls.push('blueprint');raw={kind:'reading',skill:globalThis.__exercise.skill,sourceTopic:'National parks'};}
 else if(text.includes('独立练习任务：')){globalThis.__calls.push('practice');const tasks=JSON.parse(text.split('独立练习任务：\n')[1].split('\n输出必须')[0]);raw={items:tasks.map(t=>({id:t.id,exercise:{...globalThis.__exercise,kind:t.kind,skill:t.skill,newTopic:t.newTopic}}))};}
 else if(text.startsWith('教学内容复核：')){raw={issues:[]};}
 else if(text.includes('只逐段翻译')){globalThis.__calls.push('translation');raw={translation:'大雾山以动植物多样性闻名，约塞米蒂以瀑布和山峰闻名。'};}
 else if(text.includes('本次仅生成')){const module=text.match(/本次仅生成(\w+)字段/)[1];globalThis.__calls.push(module);raw=structuredClone(globalThis.__parts[module]);if(module==='sentences'&&globalThis.__failSyntax)raw.sentences[0].parts[0].startToken=500;}
 else{globalThis.__calls.push('special');const input=JSON.parse(text.split('输入材料：\n')[1].split('\n输出必须')[0]);raw={status:'needs_review',notices:['模拟课堂结果，需教师核对'],items:input.questions.map(q=>({question_id:q.question_id,question_number:q.question_number,reference_answer:q.reference_answer,question_type:'细节',key_reason:'同义对应',options:q.options.map(o=>({label:o.label,verdict:'uncertain',evidence:[],reasoning:'需要核对',error_pattern:''})),teacher_question:'请找出原文依据。'}))};}
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});};},{parts:Object.fromEntries(['sentences','structure','lexicon','imitation'].map(m=>[m,demoGeneratedPart(m)])),exercise:demoExercise()});
 await page.reload();await page.locator('.project-row').filter({hasText:fixture.title}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();

 const controls=page.getByRole('region',{name:'生成教学内容',exact:true}),calls=()=>app.evaluate(()=>globalThis.__calls),load=()=>page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
 const names=['逐题讲评','中文译文','考点演练','句法拆解','篇章脉络','词汇手账','表达迁移','专项讲评'];
 const select=async(chosen)=>{for(const name of names)await controls.getByRole('checkbox',{name:new RegExp('^'+name)}).setChecked(chosen.includes(name));};
 await page.setViewportSize({width:1366,height:768});
 await select([]);if(await controls.getByRole('button',{name:/开始生成/}).isEnabled())throw Error('空选择可以开始');
 await select(['逐题讲评','句法拆解','词汇手账']);await shot(page,controls,'english-generation-1366');
 await controls.getByRole('button',{name:/开始生成/}).click();await finished(page);let p=await load();
 if(p.job.state!=='partial'||p.job.tasks.some(t=>!['analysis','sentences','lexicon'].includes(t.kind)))throw Error('多选范围或失败隔离不正确');
 if(p.generationJobs.analysis.state!=='complete'||p.generationJobs.lexicon.state!=='complete'||p.generationJobs.sentences.state!=='failed')throw Error('各模块状态未独立保存');
 await controls.locator('details').nth(1).evaluate(e=>{e.open=true;});await shot(page,controls.locator('.prep-module-progress').nth(1),'english-partial-failure');
 await app.evaluate(()=>{globalThis.__failSyntax=false;});const before=(await calls()).length;await controls.getByRole('button',{name:'继续所选模块的未完成项',exact:true}).click();await finished(page);
 if((await calls()).slice(before).some(k=>k!=='sentences'))throw Error('继续时重跑已完成内容');p=await load();if(p.job.state!=='complete')throw Error('句法恢复失败');
 await shot(page,controls.locator('.prep-module-progress').first(),'english-restored');
 // Slow only the in-memory mock response to exercise cancellation, never real network.
 await app.evaluate(()=>{const mock=globalThis.fetch;globalThis.fetch=async(url,init)=>{if(globalThis.__slow)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,5000);const stop=()=>{clearTimeout(timer);reject(new DOMException('Synthetic cancellation','AbortError'));};if(init.signal?.aborted)stop();else init.signal?.addEventListener('abort',stop,{once:true});});return mock(url,init);};globalThis.__slow=true;});
 await select(['中文译文']);await controls.getByRole('button',{name:/开始生成/}).click();await controls.getByRole('button',{name:'取消本次生成',exact:true}).click();await finished(page);p=await load();if(p.job.state!=='cancelled'||p.job.tasks.some(t=>t.state==='complete'))throw Error('取消状态不真实');
 if(!p.generationJobs.analysis.tasks.every(t=>t.state==='complete'))throw Error('取消清空了已保存模块');await shot(page,controls,'english-cancelled');
 await app.evaluate(()=>{globalThis.__slow=false;});await controls.getByRole('button',{name:'继续所选模块的未完成项',exact:true}).click();await finished(page);p=await load();if(p.job.state!=='complete')throw Error('取消后未能恢复');
 const outputs=page.getByRole('region',{name:'带去课堂，或留作备份',exact:true});await shot(page,outputs,'english-outputs-1366');
 const bundle=path.join(out,'english-backup.lesson.zip');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},bundle);await outputs.getByRole('button',{name:'导出备份课件包',exact:true}).click();await page.getByText('备份课件包已导出，可重新导入工作台继续备课。',{exact:true}).waitFor();const packed=await verifyBundle(bundle,fixture.id);if(!packed.generationJobs.analysis.tasks.every(t=>t.state==='complete'))throw Error('备份丢失已完成模块');
 await outputs.getByRole('button',{name:'编排并导出 PPT',exact:true}).click();await page.getByRole('heading',{name:'编排本次讲课',exact:true}).waitFor();if(!await page.locator('.lesson-groups input[type=checkbox]').count())throw Error('跳过了教师内容勾选');
 const ppt=path.join(out,'english-editable.pptx');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},ppt);await page.getByRole('button',{name:'输出可编辑 PPT',exact:true}).click();await page.getByText(/已导出 \d+ 页可编辑课件/).waitFor();const zip=unzipSync(new Uint8Array(await fs.readFile(ppt)));if(!Object.keys(zip).some(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)))throw Error('英语 PPT 缺幻灯片');
 await page.getByRole('button',{name:'返回教案',exact:true}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();await page.setViewportSize({width:1920,height:1080});await shot(page,page.locator('#prepare-generation'),'english-generation-1920');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('英语水平溢出');
 if(errors.length)throw Error(errors.join('\n'));
 results.push({subject:'english',version:await app.evaluate(({app})=>app.getVersion()),executable:executable||'development',profile,errors,bundle,ppt,checks:['空选择阻断','仅生成三个所选模块','失败隔离','仅恢复失败句法','取消保留其他已存模块','取消后恢复','备份解压核对且无凭据','新PPT入口保留原编排选择','真实本地PPT导出']});
}finally{await app.close();}
}
async function chineseChecks(){
 const profile=path.resolve('.tools/preparation-chinese-'+Date.now());
 const app=await electron.launch(launchOptions(profile));
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.setViewportSize({width:1366,height:768});
  await page.getByLabel('学科',{exact:true}).selectOption('chinese');await page.getByRole('button',{name:'新建课件',exact:true}).click();await page.getByRole('heading',{name:'整理材料，准备本次讲义',exact:true}).waitFor();
  const controls=page.getByRole('region',{name:'生成教学内容',exact:true});await page.getByRole('link',{name:'生成教学内容',exact:true}).click();if(await controls.getByRole('button',{name:'开始生成所选内容',exact:true}).isEnabled())throw Error('空语文课件可开始生成');await shot(page,controls,'chinese-empty');
  const id=await page.evaluate(async()=>{const list=await window.desk.invoke('list');const p=await window.desk.invoke('load',list.find(x=>x.subject==='chinese').id);p.title='备课流程 · 合成语文验证';p.chinese={groups:[{id:'g',section:'阅读 I',title:'多材料阅读',kind:'information',materials:[{id:'m',title:'材料一（合成验证）',text:'事实是判断的起点，观点需要证据支撑。阅读时应区分事实与推断。',sourceId:'',blockIds:[]}],questions:[{id:'q',number:'1',stem:'说明观点与证据的关系。',format:'short',materialIds:['m'],answer:'观点需要证据支撑。',confirmed:true},{id:'q2',number:'2',stem:'说明事实与推断的区别。',format:'short',materialIds:['m'],answer:'事实是判断的起点。',confirmed:true}],versions:[]},{id:'g2',section:'阅读 II',title:'本次不选的材料组',kind:'information',materials:[{id:'m2',title:'材料二',text:'这是一段合成材料，用于检查生成范围。',sourceId:'',blockIds:[]}],questions:[{id:'q3',number:'3',stem:'说明材料用途。',format:'short',materialIds:['m2'],answer:'检查生成范围。',confirmed:true}],versions:[]}]};await window.desk.invoke('save-settings',{provider:'deepseek',model:'synthetic-qa',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return (await window.desk.invoke('save',p)).id;});
  await app.evaluate(({Notification})=>{globalThis.__calls=[];Notification.prototype.show=function(){};globalThis.fetch=async(_url,init)=>{const text=JSON.parse(init.body).messages[1].content;const input=JSON.parse(text.split('\n输入：')[1].split('\n输出必须')[0]);globalThis.__calls.push({title:input.title,questions:input.questions.map(q=>q.id)});return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({status:'ok',notices:['本地模拟响应，用于界面验证'],blocks:[{label:'解题观察',text:'先找到观点需要证据支撑，再区分事实与推断。',evidence:[{materialId:'m',quote:'观点需要证据支撑。'}]},{label:'参考作答',text:'观点须有事实依据，并保持推断的边界。',evidence:[]}]})}}]});};});
  // Reload settings and fixture through the application's normal entry point.
  await page.reload();await page.locator('.project-row').filter({hasText:'备课流程 · 合成语文验证'}).click();
  await controls.getByRole('checkbox',{name:'本次不选的材料组',exact:true}).uncheck();
  await controls.locator('.prep-question-scope summary').click();await controls.getByRole('checkbox',{name:'第 2 题',exact:true}).uncheck();
  if(!await controls.getByRole('checkbox',{name:/^文言译注/}).isDisabled())throw Error('不适用的文言译注仍可选');
  await shot(page,controls,'chinese-generation-1366');await controls.getByRole('button',{name:'开始生成所选内容',exact:true}).click();await finished(page);
  let p=await page.evaluate(id=>window.desk.invoke('load',id),id);const calls=await app.evaluate(()=>globalThis.__calls);
  const actual={profile,tasks:p.chinese.tasks.map(({id,groupId,questionId,questionIds,module,state,error})=>({id,groupId,questionId,questionIds,module,state,error})),calls};
  await fs.writeFile(path.join(out,'chinese-scope-diagnostic.json'),JSON.stringify(actual,null,2));
  if(p.chinese.tasks.length!==2)throw Error('语文任务数不等于2，见 chinese-scope-diagnostic.json');
  if(p.chinese.tasks.some(t=>t.groupId!=='g'||!['analysis','structure'].includes(t.module)||t.questionIds.some(q=>q!=='q')))throw Error('语文持久化任务范围越界，见 chinese-scope-diagnostic.json');
  if(p.chinese.tasks.some(t=>t.state!=='complete'))throw Error('语文任务未完成：'+p.chinese.tasks.map(t=>t.error).filter(Boolean).join('；'));
  if(calls.length!==2)throw Error('语文模拟服务调用数不等于2，见 chinese-scope-diagnostic.json');
  if(calls.some(c=>c.title!=='多材料阅读'||c.questions.some(q=>q!=='q')))throw Error('语文模拟请求内容越界，见 chinese-scope-diagnostic.json');
  if(p.chinese.groups[1].versions.length||p.chinese.groups[0].versions.some(v=>v.confirmed))throw Error('语文模拟结果冒充确认或写入未选组');await shot(page,controls.locator('.prep-progress'),'chinese-saved');
  // Teacher confirmation remains in the unchanged reading screen.
  await page.getByRole('button',{name:'备课讲义',exact:true}).click();await page.getByRole('button',{name:'已核实，确认本版讲义',exact:true}).click();await page.locator('.zh-notes').getByRole('button',{name:'文本脉络',exact:true}).click();await page.getByRole('button',{name:'已核实，确认本版讲义',exact:true}).click();
  await page.getByRole('button',{name:'整理与核对',exact:true}).click();const outputs=page.getByRole('region',{name:'带去课堂，或留作备份',exact:true});await shot(page,outputs,'chinese-outputs');
  const bundle=path.join(out,'chinese-backup.lesson.zip');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},bundle);await outputs.getByRole('button',{name:'导出备份课件包',exact:true}).click();await page.getByText('备份课件包已导出，可重新导入工作台继续备课。',{exact:true}).waitFor();p=await verifyBundle(bundle,id);if(p.chinese.groups[0].versions.length!==2||p.chinese.groups[0].versions.some(v=>!v.confirmed))throw Error('语文备份没有保存教师确认');
  await outputs.getByRole('button',{name:'编排并导出 PPT',exact:true}).click();await page.getByRole('heading',{name:'编排本次语文讲课',exact:true}).waitFor();if(!await page.locator('.zh-setup input[type=checkbox]').count())throw Error('语文跳过教师选择');
  const ppt=path.join(out,'chinese-editable.pptx');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},ppt);await page.getByRole('button',{name:'输出可编辑 PPT',exact:true}).click();await page.getByText(/已导出 \d+ 页可编辑 PPT/).waitFor();const zip=unzipSync(new Uint8Array(await fs.readFile(ppt)));const xml=Object.entries(zip).filter(([k])=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).map(([,v])=>strFromU8(v)).join('');if(!xml.includes('先找到')||!xml.includes('观点须有事实依据'))throw Error('语文PPT缺少讲义或答案');
  await page.getByRole('button',{name:'整理与核对',exact:true}).click();await page.setViewportSize({width:1920,height:1080});await shot(page,controls,'chinese-generation-1920');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('语文水平溢出');if(errors.length)throw Error(errors.join('\n'));
  results.push({subject:'chinese',version:await app.evaluate(({app})=>app.getVersion()),executable:executable||'development',profile,errors,bundle,ppt,calls,checks:['空态锚点与禁用生成','组与题目真实筛选','两个模块一次生成','不适用模块禁用','AI保存不冒充确认','原阅读页教师确认','备份保留确认版本且无凭据','新入口进入原编排','真实本地PPT内容核对']});
 }finally{await app.close();}
}
try{if(process.argv.includes('--chinese-only')){const previous=JSON.parse(await fs.readFile(path.join(out,'qa-results.json'),'utf8'));results.push(...previous.results.filter(r=>r.subject==='english'));}else{await englishChecks();}await chineseChecks();await fs.writeFile(path.join(out,'qa-results.json'),JSON.stringify({result:'PASS',scope:'isolated synthetic IPC, mocked AI; no real accounts or network',results},null,2));console.log('PREPARATION UX QA PASS');}catch(e){await fs.writeFile(path.join(out,'qa-results.json'),JSON.stringify({result:'FAIL',error:String(e),results},null,2));throw e;}
