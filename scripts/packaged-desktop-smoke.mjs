import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { strFromU8, unzipSync } from 'fflate';

const executablePath = process.argv[2];
assert(executablePath, 'Pass the packaged Electron executable as the first argument.');
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const output = path.resolve('test-results/packaged-desktop');
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(output, 'profile-'));
const launch = () => electron.launch({
  executablePath: path.resolve(executablePath),
  args: ['--user-data-dir=' + profile],
  timeout: 60_000,
});

let app = await launch();
try {
  const errors = [];
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  const runtime = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));
  assert.deepEqual(runtime, { packaged: true, version, platform: process.platform, arch: process.arch });

  await page.locator('.library-open').first().click();
  await page.getByRole('button', { name: '授课与导出', exact: true }).click();
  await page.getByRole('heading', { name: '编排本次讲课' }).waitFor();
  const ppt = path.join(output, '示例课件.pptx');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, ppt);
  await page.getByRole('button', { name: '输出可编辑 PPT' }).click();
  await page.getByText(/已导出 \d+ 页可编辑课件/).waitFor();
  const slides = unzipSync(await fs.readFile(ppt));
  assert(Object.entries(slides).some(([file, data]) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(file) && strFromU8(data).includes('biodiversity')));

  await page.getByRole('button', { name: '开始授课' }).click();
  const jump = page.getByRole('combobox', { name: '跳转页面' });
  await jump.waitFor();
  assert.equal(await jump.inputValue(), '0');
  await page.keyboard.press('ArrowRight');
  assert.equal(await jump.inputValue(), '1');
  await page.screenshot({ path: path.join(output, 'presentation.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: '编排本次讲课' }).waitFor();

  const fixtures = ['paper.pdf', 'paper.docx'].map(name => path.resolve('tests/fixtures/chemistry-figures', name));
  await app.evaluate(({ dialog }, files) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
  }, fixtures);
  const projectId = await page.evaluate(async () => {
    const project = await window.desk.invoke('create', '跨平台合成材料', 'chemistry');
    return project.id;
  });
  const materials = await page.evaluate(async id => {
    const project = await window.desk.invoke('files', id, 'paper');
    const pdf = project.sources.find(source => source.kind === 'pdf');
    const jpeg = await window.desk.invoke('chinese-image', id, pdf.id, 1);
    return { names: project.sources.map(source => source.name), pageCount: pdf.pageCount, jpeg };
  }, projectId);
  assert.deepEqual(materials.names, ['paper.pdf', 'paper.docx']);
  assert.equal(materials.pageCount, 2);
  assert.match(materials.jpeg, /^data:image\/jpeg;base64,\/9j\//);
  assert.deepEqual(errors, []);

  await app.close();
  app = await launch();
  const reopened = await app.firstWindow();
  await reopened.locator('.library-open').filter({ hasText: '跨平台合成材料' }).waitFor();
  const storedSources = await reopened.evaluate(async id => {
    const project = await window.desk.invoke('load', id);
    return project.sources.map(source => source.name);
  }, projectId);
  assert.deepEqual(storedSources, materials.names);
  await reopened.screenshot({ path: path.join(output, 'library.png') });

  const report = {
    ...runtime,
    checks: ['launch', 'editable PPT export', 'presentation keyboard controls', 'PDF and DOCX import',
      'native PDF rasterization', 'persistence after restart'],
  };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Packaged desktop smoke passed:', report);
} finally {
  await app.close();
}
