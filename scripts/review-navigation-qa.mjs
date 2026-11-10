import { _electron as electron } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
const app = await electron.launch({ ...(process.env.QA_PACKAGED ? { executablePath: path.resolve('release/win-unpacked/讲题工作台.exe') } : {}), args: [...(process.env.QA_PACKAGED ? [] : ['.']), '--user-data-dir='+path.resolve('.tools/review-qa-'+Date.now())] });
try {
  const page = await app.firstWindow(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.waitForSelector('.project-row');
  const fixture = await page.evaluate(async () => {
    const rows = await window.desk.invoke('list'), demo = await window.desk.invoke('load', rows[0].id);
    const fresh = await window.desk.invoke('create', '批量操作隔离测试');
    const q = structuredClone(demo.questions[0]); q.confirmed = false;
    const other = { ...structuredClone(demo.passages[0]), id: 'other-group', title: '另一组' };
    const project = { ...fresh, passages: [...demo.passages, other], questions: [q,
      { ...structuredClone(q), id: 'missing', number: '22', answer: '' },
      { ...structuredClone(q), id: 'excluded', number: '23', excluded: true },
      { ...structuredClone(q), id: 'other', number: '24', passageId: other.id }],
      job: { state: 'partial', done: [q.id], errors: { [q.passageId]: 'Error: 第22题证据校验失败：引用文字与该段原文不一致。本组未保存，请核查后重试。' } } };
    await window.desk.invoke('save', project); return project;
  });
  await page.reload(); await page.waitForSelector('.project-row');
  await page.locator('.project-row').filter({ hasText: '批量操作隔离测试' }).click();
  if (await page.locator('.toc .module-directory').count()) throw Error('左侧仍存在重复模块目录');
  if (await page.locator('.toc').getByRole('button', { name: '词汇手账', exact: true }).count()) throw Error('左侧重复模块按钮');
  await page.getByRole('navigation', { name: '讲评内容', exact: true }).getByRole('button', { name: '句法拆解', exact: true }).click();
  await page.waitForSelector('.learning-panel');
  await page.locator('.toc .question-link').first().click(); await page.waitForSelector('.q-card');
  const sizes = [];
  for (const size of [{width:1366,height:768},{width:1920,height:1080}]) {
    await page.setViewportSize(size);
    await page.screenshot({ path:'test-results/navigation-'+size.width+'.png', animations:'disabled' });
    sizes.push({ ...size, overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), reading:await page.locator('.reading').count(), explanations:await page.locator('.explanations').count() });
  }
  await page.getByRole('button', { name:'整理材料', exact:true }).click();
  if (!(await page.locator('.generation-status').innerText()).includes('部分完成 · 已保存 1 题')) throw Error('生成状态未使用中文');
  await page.getByLabel('选择本组', { exact:true }).first().check();
  await page.getByRole('button', { name:'核对所选', exact:true }).click();
  await page.waitForFunction(()=>document.querySelector('.batch-report')?.textContent?.includes('跳过 2 题'));
  let p = await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  if (!p.questions[0].confirmed || p.questions.slice(1).some(q=>q.confirmed)) throw Error('核对范围或问题跳过错误');
  await page.getByRole('button', { name:'排除所选', exact:true }).click();
  await page.waitForFunction(()=>document.querySelector('.batch-report')?.textContent?.includes('已排除'));
  p = await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  if (p.questions.slice(0,3).some(q=>!q.excluded||q.confirmed) || p.questions[3].excluded) throw Error('排除影响了未选题目');
  await page.getByRole('button', { name:'恢复所选', exact:true }).click();
  await page.waitForFunction(()=>document.querySelector('.batch-report')?.textContent?.includes('已恢复'));
  p = await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  if(p.questions.some(q=>q.confirmed||q.excluded)) throw Error('恢复后没有要求重新核对');
  await page.getByLabel('选择整卷', {exact:true}).check();
  await page.getByRole('button', {name:'核对所选',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.batch-report')?.textContent?.includes('跳过 1 题'));
  p = await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  if(p.questions.filter(q=>q.confirmed).length!==3) throw Error('整卷选择未正确生效');
  await page.getByRole('button', {name:'取消核对',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.batch-report')?.textContent?.includes('已取消核对'));
  p = await page.evaluate(id=>window.desk.invoke('load',id),fixture.id);
  if(p.questions.some(q=>q.confirmed))throw Error('取消核对未保存');
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/review-batch.png',animations:'disabled'});
  await page.locator('.generation-status').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/generation-status.png',animations:'disabled'});
  if(errors.length||sizes.some(s=>s.overflow||!s.reading||!s.explanations)) throw Error(JSON.stringify({errors,sizes}));
  await fs.writeFile('test-results/review-navigation-qa.json', JSON.stringify({errors,sizes,checks:['题目目录无重复模块','右侧切换模块','点击题号定位','本组选择','整卷选择','跳过缺答案与已排除题','排除限定范围','恢复后重新核对','取消核对','中文失败状态与详情']},null,2));
  console.log('REVIEW / NAVIGATION QA PASS');
} finally { await app.close(); }
