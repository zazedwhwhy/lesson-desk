import { _electron as electron } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';

const profile = path.resolve('.tools/lesson-deck-qa-' + Date.now());
const output = path.resolve('test-results/授课与PPT新版示例.pptx');
await fs.mkdir('test-results', { recursive: true });
const app = await electron.launch({ executablePath: path.resolve('release/win-unpacked/讲题工作台.exe'), args: ['--user-data-dir=' + profile], timeout: 60000 });
try {
  const page = await app.firstWindow(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: /国家公园 · 英语讲题示例/ }).first().click();
  await page.getByRole('button', { name: '开始授课', exact: true }).click();
  await page.waitForSelector('.lesson-setup');
  const modules = await page.locator('.lesson-group .lesson-choice').allTextContents();
  if (!['逐题讲评', '句法拆解', '篇章脉络', '词汇手账', '表达迁移'].every(name => modules.some(text => text.includes(name)))) throw Error('授课选择器缺少教学内容');
  await page.screenshot({ path: 'test-results/授课编排新版.png', animations: 'disabled' });
  await page.locator('.lesson-setup-actions .primary').click();
  await page.waitForSelector('.lesson-slide');
  const options = await page.getByLabel('跳转页面').locator('option').allTextContents();
  const analysis = options.findIndex(text => text.includes('逐题讲评'));
  if (analysis < 0) throw Error('放映中没有逐题讲评');
  await page.getByLabel('跳转页面').selectOption(String(analysis));
  if (!(await page.locator('.slide-content').innerText()).includes('biodiversity')) throw Error('放映中没有 AI 解析');
  const desktopOverflow = await page.evaluate(() => { const el = document.querySelector('.slide-content'); return el.scrollHeight > el.clientHeight + 2; });
  if (desktopOverflow) throw Error('投屏页面有内容裁切');
  await page.screenshot({ path: 'test-results/授课讲评新版.png', animations: 'disabled' });
  await page.getByRole('button', { name: '返回编排' }).click();
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, output);
  await page.getByRole('button', { name: '输出可编辑 PPT' }).click();
  await page.getByRole('status').getByText(/已导出/).waitFor();
  const files = unzipSync(new Uint8Array(await fs.readFile(output)));
  const xml = Object.entries(files).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([, data]) => strFromU8(data)).join('\n');
  for (const text of ['Which park is famous', '先找题干中的 biodiversity', '句法拆解', '篇章脉络', '词汇手账']) if (!xml.includes(text)) throw Error('PPT 缺少内容：' + text);
  if (errors.length) throw Error('界面错误：' + errors.join('; '));
  console.log(JSON.stringify({ result: 'PASS', slides: Object.keys(files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, output }));
} finally { await app.close(); }
