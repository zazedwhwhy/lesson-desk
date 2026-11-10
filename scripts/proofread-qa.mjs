import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const app=await electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+path.resolve('.tools/proofread-qa-'+Date.now())]});
try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.waitForSelector('.project-row');
  const fixture=await page.evaluate(async()=>{
    const rows=await window.desk.invoke('list'),demo=await window.desk.invoke('load',rows[0].id),fresh=await window.desk.invoke('create','试卷校对隔离测试');
    const q=structuredClone(demo.questions[0]);q.options.push('C. Another park.','D. A city.');q.number='21';
    const second={...structuredClone(q),id:'q23',number:'23',answer:''};
    const p={...fresh,passages:demo.passages,questions:[q,second],sources:[{id:'paper',name:'测试试卷',role:'paper',kind:'text',blocks:[{id:'original21',text:'21. Which park is famous for its biodiversity?'},{id:'original22',text:'22. A question missing from the organized list.'}]},{id:'answer',name:'测试答案',role:'answer',kind:'text',blocks:[{id:'key21',text:'21. A 22. B 23. C'}]}]};
    await window.desk.invoke('save',p);await window.desk.invoke('save-settings',{provider:'deepseek',model:'isolated-test',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return p;
  });
  await app.evaluate(()=>{
    globalThis.__proofMode='ok';globalThis.__proofInputs=[];
    globalThis.fetch=async(_url,init)=>{
      const body=JSON.parse(init.body),content=body.messages[1].content;
      const input=JSON.parse(content.split('待校对资料：\n')[1].split('\n输出必须为json，结构：')[0]);
      globalThis.__proofInputs.push(input);
      if(globalThis.__proofMode==='fail')return new Response('{}',{status:401});
      if(globalThis.__proofMode==='cancel')await new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
      const result={coverage:globalThis.__proofMode==='partial'?'partial':'complete',checkedQuestionIds:input.questions.map(q=>q.id),checkedSourceIds:input.sources.map(s=>s.id),limitations:[],findings:[{category:'answer_mismatch',severity:'warning',questionIds:[input.questions[1].id],passageIds:[],description:'第23题缺少答案，请对照答案来源补充。',suggestion:'先核对原答案第23题，再由老师填写。',evidence:[{sourceId:input.sources[1].id,blockId:input.sources[1].blocks[0].id,quote:globalThis.__proofMode==='badEvidence'?'fake quote':'23. C'}]}]};
      if(globalThis.__proofMode==='partial'){result.checkedQuestionIds.pop();result.limitations=['第二题未完成复核。'];}
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
    };
  });
  await page.reload();await page.locator('.project-row').filter({hasText:fixture.title}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();
  const panel=page.getByRole('region',{name:'试卷校对',exact:true});
  if(!(await panel.innerText()).includes('原材料出现编号 22'))throw Error('来源漏题没有被发现');
  await panel.getByRole('button',{name:'定位题目',exact:true}).last().click();
  if(!await page.locator('#review-q-q23').count())throw Error('题目定位入口无效');
  await panel.getByLabel('同时复核已有讲解',{exact:true}).check();
  await panel.getByRole('button',{name:'AI 校对试卷',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.proofread-meta')?.textContent?.includes('isolated-test'));
  let saved=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  const firstInput=await app.evaluate(()=>globalThis.__proofInputs[0]);if(firstInput.questions.some(q=>!('explanation'in q)))throw Error('已选择的讲解复核范围未发送');
  if(!saved.proofread||JSON.stringify(saved.questions)!==JSON.stringify(fixture.questions))throw Error('校对修改了题目或没有保存报告');
  await panel.getByRole('button',{name:'查看出处 · 测试答案',exact:true}).click();
  if(await page.getByLabel('选择原材料',{exact:true}).inputValue()!=='answer')throw Error('出处定位未切换材料');
  if(!await page.locator('#review-source-answer-key21').count())throw Error('出处段落不存在');
  const old=saved.proofread.id;
  await app.evaluate(()=>{globalThis.__proofMode='fail';});
  await panel.getByRole('button',{name:'AI 校对试卷',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('401'));
  saved=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(saved.proofread.id!==old)throw Error('API失败覆盖了报告');
  await app.evaluate(()=>{globalThis.__proofMode='badEvidence';});
  await panel.getByRole('button',{name:'AI 校对试卷',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('引用未通过'));
  saved=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(saved.proofread.id!==old)throw Error('假证据进入报告');
  await app.evaluate(()=>{globalThis.__proofMode='cancel';});
  await panel.getByRole('button',{name:'AI 校对试卷',exact:true}).click();await page.locator('.busy').getByRole('button',{name:'取消任务',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('取消'));
  saved=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(saved.proofread.id!==old)throw Error('取消覆盖了报告');
  await app.evaluate(()=>{globalThis.__proofMode='partial';});
  await panel.getByLabel('同时复核已有讲解',{exact:true}).uncheck();
  await panel.getByRole('button',{name:'AI 校对试卷',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.proofread-panel')?.textContent?.includes('仅完成部分检查'));
  const last=await app.evaluate(()=>globalThis.__proofInputs.at(-1));if(last.questions.some(q=>'explanation'in q))throw Error('范围关闭后仍外发解析');
  await page.locator('#review-q-q23').getByLabel('参考答案',{exact:true}).fill('C');await page.locator('#review-q-q23').getByLabel('参考答案',{exact:true}).blur();
  await page.waitForSelector('.proofread-stale');
  const sizes=[];for(const size of[{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/proofread-'+size.width+'.png',animations:'disabled'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
  await page.reload();await page.locator('.project-row').filter({hasText:fixture.title}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();await page.waitForSelector('.proofread-stale');
  if(errors.length||sizes.some(s=>s.overflow))throw Error(JSON.stringify({errors,sizes}));
  await fs.writeFile('test-results/proofread-qa.json',JSON.stringify({packaged:!!process.env.QA_PACKAGED,version:await app.evaluate(({app})=>app.getVersion()),errors,sizes,checks:['本地漏题与缺答案','真实IPC与模拟AI响应','AI结果保存','题目与出处定位','401不覆盖上次报告','伪造证据拒绝','取消保留报告','部分范围明确显示','不发送未选解析','内容修改使报告过期','重启后保留报告']},null,2));
  console.log('PROOFREAD QA PASS');
}finally{await app.close();}
