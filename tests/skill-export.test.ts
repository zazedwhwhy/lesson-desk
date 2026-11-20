import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {strFromU8, unzipSync} from 'fflate';
import {expect, it} from 'vitest';
import {Store} from '../src/desktop/store';
import {chineseAvailable} from '../src/core/chinese';
import {buildSkillLesson} from '../skills/lesson-desk-export/tool/build-lesson';

const sampleImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX3sAAAAASUVORK5CYII=', 'base64');

it('同时生成可编辑课件与可导入的备份，保留原文件并跳过答案冲突题', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-'));
  try {
    const original = Buffer.from('%PDF-1.4\n% synthetic attachment test\n');
    await writeFile(path.join(root, 'paper.pdf'), original);
    const paragraph = {id: 'p1', text: 'The students planted trees to shade the playground.'};
    const project = {
      title: '每周阅读讲评', subject: 'english',
      sources: [{id: 'paper', name: 'paper.pdf', role: 'paper', kind: 'pdf', blocks: [paragraph]}],
      passages: [{id: 'reading', title: 'Planting Trees', type: 'reading', paragraphs: [paragraph]}],
      questions: [21, 22].map(number => ({
        id: `q${number}`, number: String(number), passageId: 'reading', type: 'reading',
        sourceId: 'paper', stem: 'Why did the students plant trees?', options: ['A. Shade', 'B. Fruit'], answer: number === 21 ? 'A' : 'B',
        analysis: {answer: 'A', text: 'The phrase “to shade” gives the purpose.', evidence: [{blockId: 'p1', quote: 'to shade the playground'}]},
      })),
    };
    const result = await buildSkillLesson({project, assets: {paper: 'paper.pdf'}}, root, path.join(root, 'output'));
    const store = new Store(path.join(root, 'imported'));
    const imported = await store.unpack(await readFile(result.bundle));
    expect(imported.questions.map(q => [q.answer, q.confirmed, q.excluded, q.versions[0].conflict])).toEqual([['A', false, false, false], ['B', false, true, true]]);
    expect(imported.organizationIssues).toEqual([expect.stringContaining('第 22 题')]);
    expect(await readFile(path.join(store.dir(imported.id), imported.sources[0].asset!))).toEqual(original);
    const ppt = unzipSync(await readFile(result.pptx));
    const slides = Object.keys(ppt).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => strFromU8(ppt[name]));
    expect(slides.join()).toContain('第 21 题');
    expect(slides.join()).toContain('to shade the playground');
    expect(slides.join()).not.toContain('第 22 题');
    expect(await readFile(result.review, 'utf8')).toContain('第 22 题');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('语文核对稿使用原文引用和题号，导入后讲义仍待确认', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-chinese-'));
  try {
    await writeFile(path.join(root, 'page.png'), sampleImage);
    const original = '细雨停了，屋檐还在滴水。';
    const manifest = {project: {title: '现代文讲评', subject: 'chinese',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'text', blocks: [{id: 'b1', text: original}]}],
      groups: [{id: 'g1', section: '现代文阅读', title: '雨后', kind: 'literature',
        materials: [{id: 'm1', title: '雨后原文', text: original, sourceId: 'paper', blockIds: ['b1'], imageFile: 'page.png'}],
        questions: [{id: 'q7', number: '7', stem: '末句表现了怎样的环境？', format: 'short', materialIds: ['m1'], answer: '雨后安静。'}],
        versions: [{module: 'analysis', questionId: 'q7', result: {status: 'ok', notices: [], blocks: [
          {label: '分析', text: '滴水声衬托雨后的安静。', evidence: [{materialId: 'm1', quote: '屋檐还在滴水'}]},
        ]}}],
      }],
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'));
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    const group = imported.chinese!.groups[0];
    expect(group.versions[0]).toMatchObject({confirmed: false, questionId: 'q7'});
    expect(group.materials[0].imageConfirmed).toBe(false);
    group.materials[0].imageConfirmed = true;
    group.questions[0].confirmed = true;
    group.versions[0].confirmed = true;
    expect(chineseAvailable(imported.chinese!, group, group.versions[0])).toBe(true);
    const ppt = unzipSync(await readFile(result.pptx));
    expect(strFromU8(ppt['ppt/slides/slide4.xml'])).toContain('雨后安静。');
    expect(strFromU8(ppt['ppt/slides/slide4.xml'])).toContain('屋檐还在滴水');
    manifest.project.groups[0].versions[0].result.blocks[0].evidence[0].quote = '大风吹过';
    await expect(buildSkillLesson(manifest, root, path.join(root, 'invalid'))).rejects.toThrow('讲义引用与关联材料不一致');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('化学课件可保留题图和公式，教师核对选项进入原生项目状态', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-chemistry-'));
  try {
    const image = sampleImage;
    await writeFile(path.join(root, 'figure.png'), image);
    const manifest = {project: {title: '化学反应讲评', subject: 'chemistry',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'text', blocks: [{id: 'b1', text: '写出氢气燃烧的化学方程式。'}]}],
      questions: [{id: 'q4', number: '4', stem: '写出氢气燃烧的化学方程式。', answer: '$\\ce{2H2 + O2 -> 2H2O}$', sourceId: 'paper', imageMode: 'vision',
        images: [{id: 'i1', name: '原题图', file: 'figure.png'}],
        versions: [{module: 'analysis', result: {status: 'ok', notices: [], blocks: [{label: '方程式', text: '$\\ce{2H2 + O2 -> 2H2O}$'}]}}],
      }],
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'), true);
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    const question = imported.chemistry!.questions[0];
    expect(question.confirmed).toBe(true);
    expect(question.versions[0].confirmed).toBe(true);
    expect(Buffer.from(question.images[0].data.split(',')[1], 'base64')).toEqual(image);
    const ppt = unzipSync(await readFile(result.pptx));
    expect(Object.keys(ppt).some(part => /^ppt\/media\/.*\.svg$/.test(part))).toBe(true);
    expect(Object.entries(ppt).some(([part, bytes]) => /^ppt\/media\/.*\.png$/.test(part) && Buffer.from(bytes).equals(image))).toBe(true);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
