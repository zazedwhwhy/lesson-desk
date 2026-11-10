import {_electron as electron}from'playwright';import fs from'node:fs/promises';import path from'node:path';
const app=await electron.launch({...(process.env.QA_PACKAGED?{executablePath:path.resolve('release/win-unpacked/讲题工作台.exe')}:{ }),args:[...(process.env.QA_PACKAGED?[]:['.']),'--user-data-dir='+path.resolve('.tools/correction-qa-'+Date.now())]});
try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.waitForSelector('.project-row');
  const fixture=await page.evaluate(async()=>{const rows=await window.desk.invoke('list'),demo=await window.desk.invoke('load',rows[0].id),fresh=await window.desk.invoke('create','AI自动修正隔离测试');const q=structuredClone(demo.questions[0]);q.number='41';q.answer='B';q.options.push('C. Another park.','D. A city.');const p={...fresh,passages:demo.passages,questions:[q],sources:[{id:'paper',name:'试卷节选',role:'paper',kind:'text',blocks:[{id:'s1',text:'41. Which park is famous for its biodiversity? A. Great Smoky Mountains. B. Yosemite. C. Another park. D. A city.'}]},{id:'key',name:'答案节选',role:'answer',kind:'text',blocks:[{id:'k1',text:'41-43 ACB'}]}]};await window.desk.invoke('save',p);await window.desk.invoke('save-settings',{provider:'deepseek',model:'isolated-test',baseUrl:'https://api.deepseek.com',key:'synthetic-test-credential'});return p;});
  await app.evaluate(()=>{
    globalThis.__correctionMode='recheckFail';globalThis.__correctionCalls=[];
    globalThis.fetch=async(_url,init)=>{
      const body=JSON.parse(init.body),text=body.messages[1].content,isCorrection=text.includes('自动修正资料：\n'),marker=isCorrection?'自动修正资料：\n':'待校对资料：\n';
      const input=JSON.parse(text.split(marker)[1].split('\n输出必须为json，结构：')[0]);globalThis.__correctionCalls.push({kind:isCorrection?'correction':'proofread',answer:input.questions[0].referenceAnswer});
      if(isCorrection&&globalThis.__correctionMode==='cancel')await new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});});
      if(!isCorrection&&input.questions[0].referenceAnswer==='A'&&globalThis.__correctionMode==='recheckFail')return new Response('{}',{status:401});
      const evidence=[{sourceId:input.sources[1].id,blockId:input.sources[1].blocks[0].id,quote:'41-43 ACB'}];
      const result=isCorrection?{operations:[{kind:'question',questionId:input.questions[0].id,field:'answer',before:'B',after:globalThis.__correctionMode==='badPatch'?'D':'A',reason:'对照答案来源恢复第41题答案A。',evidence}],unresolved:[]}:{coverage:'complete',checkedQuestionIds:input.questions.map(q=>q.id),checkedSourceIds:input.sources.map(s=>s.id),limitations:[],findings:input.questions[0].referenceAnswer==='B'?[{category:'answer_mismatch',severity:'error',questionIds:[input.questions[0].id],passageIds:[],description:'第41题当前答案B与来源A不符。',suggestion:'恢复为A。',evidence}]:[]};
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
    };
  });
  await page.reload();await page.locator('.project-row').filter({hasText:fixture.title}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();
  const auto=page.getByRole('button',{name:'AI 自动修正',exact:true}),undo=page.getByRole('button',{name:'撤销上次自动修正',exact:true});
  await auto.click();await page.waitForFunction(()=>document.querySelector('.correction-warning')?.textContent?.includes('失败'));
  let p=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(p.questions[0].answer!=='A'||p.corrections.at(-1).recheck!=='failed'||p.questions[0].confirmed)throw Error('复核失败丢失修改或核对状态错误');
  if(JSON.stringify(p.questions[0].versions)!==JSON.stringify(fixture.questions[0].versions))throw Error('旧解析被覆盖');
  await undo.click();await page.waitForFunction(()=>document.querySelector('.correction-history')?.textContent?.includes('已撤销'));
  p=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(JSON.stringify(p.questions)!==JSON.stringify(fixture.questions))throw Error('撤销没有恢复原题');
  await app.evaluate(()=>{globalThis.__correctionMode='ok';});await auto.click();await page.waitForFunction(()=>document.querySelector('.correction-record')?.textContent?.includes('已再次校对'));
  p=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(p.questions[0].answer!=='A'||p.corrections.at(-1).recheck!=='complete'||p.proofread.result.findings.length)throw Error('完整修正与复核未完成');
  const sizes=[];for(const size of[{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/auto-correct-'+size.width+'.png',animations:'disabled'});sizes.push({...size,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
  await page.locator('.correction-change').first().locator('summary').click();await page.locator('.correction-history').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/auto-correct-history.png',animations:'disabled'});
  await undo.click();await page.waitForFunction(()=>document.querySelectorAll('.correction-meta').length===2&&[...document.querySelectorAll('.correction-meta')].every(el=>el.textContent.includes('已撤销')));
  await app.evaluate(()=>{globalThis.__correctionMode='badPatch';});await auto.click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('答案'));
  p=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(p.questions[0].answer!=='B'||p.corrections.length!==2)throw Error('无依据补丁被应用');
  await app.evaluate(()=>{globalThis.__correctionMode='cancel';});await auto.click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('正在生成并校验'));await page.locator('.busy').getByRole('button',{name:'取消任务',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.notice')?.textContent?.includes('取消'));
  p=await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);if(p.questions[0].answer!=='B'||p.corrections.length!==2)throw Error('取消前仍应用了修改');
  await page.reload();await page.locator('.project-row').filter({hasText:fixture.title}).click();await page.getByRole('button',{name:'整理材料',exact:true}).click();if(!await page.getByRole('region',{name:'自动修改记录',exact:true}).count())throw Error('修改记录未持久化');
  if(errors.length||sizes.some(s=>s.overflow))throw Error(JSON.stringify({errors,sizes}));
  await fs.writeFile('test-results/correction-qa.json',JSON.stringify({packaged:!!process.env.QA_PACKAGED,version:await app.evaluate(({app})=>app.getVersion()),errors,sizes,checks:['校对→修正→再校对','复核失败保留已保存修改','撤销恢复原题','旧解析保留','取消核对','未知答案阻断','取消不应用','记录持久化'],calls:await app.evaluate(()=>globalThis.__correctionCalls)},null,2));console.log('AUTO CORRECTION QA PASS');
}finally{await app.close();}
