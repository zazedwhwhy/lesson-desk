import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {strFromU8, unzipSync} from 'fflate';
import {expect, it} from 'vitest';
import {Store} from '../src/desktop/store';
import {chineseAvailable} from '../src/core/chinese';
import {defaultLessonSelection, lessonAvailability} from '../src/core/lesson-deck';
import {demoExercise} from '../src/core/exercise-demo';
import {questionExercise} from '../src/core/logic';
import {proofreadFingerprint} from '../src/core/proofread';
import {chemistryReviewSnapshot} from '../src/core/chemistry-review';
import {undoCorrection} from '../src/core/correction';
import {buildSkillLesson} from '../skills/lesson-desk-export/tool/build-lesson';

const sampleImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX3sAAAAASUVORK5CYII=', 'base64');

function vocabularyManifest() {
  const paragraph = {id: 'p1', text: 'The students planted trees to shade the playground.'};
  const lexicon = [{
    term: 'shade', sourceForm: 'shade', partOfSpeech: 'v.', meaning: '为……遮阳',
    usageNote: 'shade 作及物动词，后接 the playground，说明种树的目的。',
    collocations: 'shade a window 给窗户遮阳', contrast: 'shade 强调遮挡直射光；cover 强调覆盖。',
    memoryExample: 'The curtain shades the window.', exampleTranslation: '窗帘为这扇窗遮阳。',
    evidence: {blockId: 'p1', quote: paragraph.text},
  }];
  return {selection: [{passageId: 'reading', module: 'source'}, {passageId: 'reading', module: 'lexicon'}], project: {
    title: '校园阅读 · 词汇手账', subject: 'english',
    sources: [{id: 'paper', name: '校园阅读', role: 'paper', kind: 'text', blocks: [paragraph]}],
    passages: [{id: 'reading', title: 'Planting Trees', type: 'reading', paragraphs: [paragraph], lexicon}],
    questions: [],
  }};
}

it('拼错的嵌套字段报出路径，漏生成的所选模块阻断出片', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-scope-'));
  try {
    const manifest = vocabularyManifest();
    const output = path.join(root, 'output');
    const {lexicon, ...passage} = manifest.project.passages[0];
    const project = {...manifest.project, passages: [passage]};
    await expect(buildSkillLesson({...manifest, project: {...project, passages: [{...passage, lexcion: lexicon}]}}, root, output))
      .rejects.toThrow('project.passages.0.lexcion');
    await expect(buildSkillLesson({...manifest, project}, root, output)).rejects.toThrow(/Planting Trees.*词汇手账/);
    await expect(buildSkillLesson({project}, root, output)).rejects.toThrow('导出 PPT 需要 selection');
    await expect(readFile(path.join(output, '讲评课件.lesson.zip'))).rejects.toMatchObject({code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('按答案原文阻断不一致的参考答案，明确试解只能以待核对稿保存', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-answer-'));
  try {
    const {project} = vocabularyManifest();
    const key = {id: 'key', name: '答案', role: 'answer', kind: 'text', blocks: [{id: 'a21', text: '21. B'}]};
    const question = {id: 'q21', number: '21', passageId: 'reading', type: 'reading', sourceId: 'paper',
      stem: 'Why did the students plant trees?', options: ['A. Fruit', 'B. Shade'],
      analysis: {answer: 'A', text: 'The phrase “to shade” gives the purpose.'}};
    const selection = [{passageId: 'reading', questionId: 'q21', module: 'analysis'}];
    const ref = {sourceId: 'key', blockId: 'a21', quote: '21. B'};
    const manifest = {selection, project: {...project, sources: [...project.sources, key],
      questions: [{...question, answer: 'A', answerEvidence: ref}]}};
    await expect(buildSkillLesson(manifest, root, path.join(root, 'bad-key'))).rejects.toThrow(/第 21 题.*答案.*B/);
    const longerKey = {...key, blocks: [{id: 'a21', text: '21. BC'}]};
    await expect(buildSkillLesson({selection, project: {...manifest.project, sources: [...project.sources, longerKey],
      questions: [{...question, answer: 'B', answerEvidence: ref}]}}, root, path.join(root, 'partial-key')))
      .rejects.toThrow(/第 21 题.*完整答案行/);
    await expect(buildSkillLesson({...manifest, project: {...project, questions: [{...question, answer:'A'}]}},
      root, path.join(root, 'unbound'))).rejects.toThrow(/第 21 题.*答案来源/);
    const draft = {project: {...project, questions: [{...question, trialAnswer: 'A'}]}};
    const trial = await buildSkillLesson(draft, root, path.join(root, 'trial'), false, true);
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(trial.bundle));
    expect(imported.questions[0]).toMatchObject({answer: '', confirmed: false, versions: [{answer: 'A', conflict: true}]});
    expect(await readFile(trial.review, 'utf8')).toContain('待核对试解');
    await expect(buildSkillLesson({...draft, selection}, root, path.join(root, 'not-ready')))
      .rejects.toThrow(/第 21 题.*待核对试解/);
    const confirmed = {selection, project: {...project, questions: [{...question, answer: 'A', answerOrigin: 'teacher'}]}};
    await expect(buildSkillLesson(confirmed, root, path.join(root, 'unapproved'))).rejects.toThrow(/第 21 题.*教师/);
    const reviewed = await buildSkillLesson(confirmed, root, path.join(root, 'confirmed'), true);
    expect(reviewed.pages).toBeGreaterThan(0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('只有原文时也能生成词汇手账，导入后保留原句、例句译文和自动回忆题', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-lexicon-'));
  try {
    const manifest = vocabularyManifest();
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'));
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    const passage = imported.passages[0];
    expect(imported.questions).toEqual([]);
    expect(passage.learning?.versions[0]).toMatchObject({origin: 'ai', completedModules: ['lexicon']});
    expect(passage.learning?.versions[0].data.lexicon[0]).toMatchObject({
      term: 'shade', sourceQuote: passage.paragraphs[0].text,
      memoryExample: 'The curtain shades the window.', exampleTranslation: '窗帘为这扇窗遮阳。',
      quiz: expect.stringContaining('to [1] the playground.'), answer: expect.stringContaining('shade：为……遮阳'),
    });
    expect(lessonAvailability(imported, passage.id, 'lexicon')).toBeNull();
    expect(defaultLessonSelection(imported)).toEqual({
      passageIds: ['reading'], questionIds: [], modules: {reading: ['source', 'lexicon']},
    });
    const ppt = unzipSync(await readFile(result.pptx));
    const slides = Object.keys(ppt).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => strFromU8(ppt[name])).join('\n');
    expect(slides).toContain('词汇手账 · shade');
    expect(slides).toContain('窗帘为这扇窗遮阳');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it.each([
  {label: '引用不实', changes: {evidence: {blockId: 'p1', quote: 'The students painted trees.'}}, error: '引用文字与该段原文不一致'},
  {label: '原文形态不实', changes: {sourceForm: 'shaded'}, error: '原文形态不在所引原句中'},
])('词汇手账拒绝$label', async ({changes, error}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-lexicon-invalid-'));
  try {
    const manifest = vocabularyManifest();
    Object.assign(manifest.project.passages[0].lexicon[0], changes);
    const output = path.join(root, 'output');
    await expect(buildSkillLesson(manifest, root, output)).rejects.toThrow(error);
    await expect(readFile(path.join(output, '讲评课件.lesson.zip'))).rejects.toMatchObject({code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('独立专项讲评进入英语原生讲义和 PPT，教师确认原题后仍有效', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-special-'));
  try {
    const stem = 'Write an email to welcome new students. Include two activities.';
    const manifest = {selection: [{passageId: 'writing', module: 'special'}], project: {subject: 'english', title: '写作审题单',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'text', blocks: [{id: 'b1', text: stem}]}],
      questions: [{id: 'q1', number: '1', passageId: 'writing', type: 'writing', sourceId: 'paper', stem}],
      passages: [{id: 'writing', title: 'Welcome email', type: 'writing', paragraphs: [],
        special: {kind: 'writing_task', input: {material_complete: true, extra: '', opening1: '', opening2: '', questionIds: ['q1']},
          result: {status: 'ok', notices: [], items: [{
            task_summary: '写欢迎邮件', explicit_requirements: [{field: '内容', requirement: '写两项活动', evidence: 'Include two activities.'}],
            unspecified: [], outline_suggestion: [], expression_directions: [], checklist: ['写出两项活动'], teacher_question: '要写几项活动？',
          }]},
        },
      }],
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'));
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    expect(imported.questions[0].confirmed).toBe(false);
    expect(imported.passages[0].special?.versions[0].result.items[0].task_summary).toBe('写欢迎邮件');
    imported.questions[0].confirmed = true;
    expect(lessonAvailability(imported, 'writing', 'special')).toBeNull();
    const ppt = unzipSync(await readFile(result.pptx));
    expect(Object.entries(ppt).some(([name, bytes]) => /^ppt\/slides\/slide\d+\.xml$/.test(name) && strFromU8(bytes).includes('写作审题单'))).toBe(true);
    manifest.project.passages[0].special.result.items[0].explicit_requirements[0].evidence = 'invented requirement';
    await expect(buildSkillLesson(manifest, root, path.join(root, 'invalid'))).rejects.toThrow('没有对应原题证据');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('独立考点演练无需生成原题解析即可进入 PPT 和导入讲义', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-practice-'));
  try {
    const {project} = vocabularyManifest();
    const skill = demoExercise();
    const key = {id: 'key', name: '答案', role: 'answer', kind: 'text', blocks: [{id: 'a1', text: '1. A'}]};
    const q = {id: 'q1', number: '1', passageId: 'reading', type: 'reading', sourceId: 'paper',
      stem: 'Why did the students plant trees?', options: ['A. Shade', 'B. Fruit'], answer: 'A', practice: skill,
      answerEvidence: {sourceId: 'key', blockId: 'a1', quote: '1. A'}};
    const result = await buildSkillLesson({selection: [{passageId: 'reading', questionId: 'q1', module: 'practice'}],
      project: {...project, sources: [...project.sources, key], questions: [q]}}, root, path.join(root, 'output'));
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    expect(imported.questions[0].versions).toEqual([]);
    expect(questionExercise(imported, imported.questions[0])?.answer).toBe(skill.answer);
    const ppt = unzipSync(await readFile(result.pptx));
    const slides = Object.keys(ppt).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => strFromU8(ppt[name])).join('\n');
    expect(slides).toContain('第 1 题 · 考点演练');
    expect(slides).toContain('第 1 题 · 演练讲评');
    expect(slides).not.toContain('第 1 题 · 逐题讲评');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('只做扫描识别和校对也能导入，保留原文件、核对状态和原生报告', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-review-'));
  try {
    await writeFile(path.join(root, 'paper.pdf'), '%PDF-1.4\n% synthetic attachment test\n');
    const manifest = {assets: {paper: 'paper.pdf'}, project: {subject: 'english', title: '扫描件待核对',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'pdf', pageCount: 2,
        blocks: [{id: 'p1', page: 1, text: 'She added one more book.'}],
        ocr: [{page: 1, uncertain: ['book 字样待核实']}, {page: 2, blank: true}]}],
      questions: [], passages: [], review: {result: {coverage: 'partial', checkedQuestionIds: [], checkedSourceIds: ['paper'],
        limitations: ['尚未人工核对扫描页'], findings: []}},
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'), false, true);
    const store = new Store(path.join(root, 'imported'));
    const imported = await store.unpack(await readFile(result.bundle));
    expect(result).toMatchObject({pages: 0, pptx: undefined});
    expect(imported.sources[0].ocrReviewPages).toEqual([1, 2]);
    expect(imported.sources[0].ocrTranscriptions?.[0].uncertain).toEqual(['book 字样待核实']);
    expect(imported.proofread?.inputSnapshot).toBe(proofreadFingerprint(imported, false));
    expect(await readFile(result.review, 'utf8')).toContain('尚未人工核对扫描页');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('自动修正复用来源证据校验，导入保留可撤销记录', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-correction-'));
  try {
    const {project} = vocabularyManifest();
    const corrected = 'Why did the students plant trees?', before = 'Why did the students plant flowers?';
    project.sources[0].blocks.push({id: 'stem', text: corrected});
    const manifest = {project: {...project,
      questions: [{id: 'q1', number: '1', passageId: 'reading', type: 'reading', sourceId: 'paper', stem: before, options: ['A. Shade', 'B. Fruit']}],
      correction: {plan: {operations: [{kind: 'question', questionId: 'q1', field: 'stem', before, after: corrected,
        reason: '对照原卷改回 trees', evidence: [{sourceId: 'paper', blockId: 'stem', quote: corrected}]}], unresolved: []}},
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'), false, true);
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    expect(imported.questions[0]).toMatchObject({stem: corrected, confirmed: false});
    expect(undoCorrection(imported).questions[0].stem).toBe(before);
    expect(await readFile(result.review, 'utf8')).toContain('修正后请重新校对');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

it('同包生成讲评与词汇手账，保留原文件并跳过答案冲突题', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lesson-skill-'));
  try {
    const original = Buffer.from('%PDF-1.4\n% synthetic attachment test\n');
    await writeFile(path.join(root, 'paper.pdf'), original);
    const paragraph = {id: 'p1', text: 'The students planted trees to shade the playground.'};
    const project = {
      title: '每周阅读讲评', subject: 'english',
      sources: [{id: 'paper', name: 'paper.pdf', role: 'paper', kind: 'pdf', blocks: [paragraph]},
        {id: 'key', name: '答案', role: 'answer', kind: 'text', blocks: [{id: 'a21-22', text: '21–22 AB'}]}],
      passages: [{...vocabularyManifest().project.passages[0], paragraphs: [paragraph]}],
      questions: [21, 22].map(number => ({
        id: `q${number}`, number: String(number), passageId: 'reading', type: 'reading',
        sourceId: 'paper', stem: 'Why did the students plant trees?', options: ['A. Shade', 'B. Fruit'], answer: number === 21 ? 'A' : 'B',
        answerEvidence: {sourceId: 'key', blockId: 'a21-22', quote: '21–22 AB'},
        analysis: {answer: 'A', text: 'The phrase “to shade” gives the purpose.', evidence: [{blockId: 'p1', quote: 'to shade the playground'}]},
      })),
    };
    const selection = [...vocabularyManifest().selection, {passageId: 'reading', questionId: 'q21', module: 'analysis'}];
    const result = await buildSkillLesson({project, selection, assets: {paper: 'paper.pdf'}}, root, path.join(root, 'output'));
    await expect(buildSkillLesson({project, selection: [...selection, {passageId: 'reading', questionId: 'q22', module: 'analysis'}],
      assets: {paper: 'paper.pdf'}}, root, path.join(root, 'includes-conflict'))).rejects.toThrow(/第 22 题.*待核实/);
    const store = new Store(path.join(root, 'imported'));
    const imported = await store.unpack(await readFile(result.bundle));
    expect(imported.questions.map(q => [q.answer, q.confirmed, q.excluded, q.versions[0].conflict])).toEqual([['A', false, false, false], ['B', false, true, true]]);
    expect(imported.organizationIssues).toEqual([expect.stringContaining('第 22 题')]);
    expect(imported.passages[0].learning?.versions[0].data.lexicon[0].term).toBe('shade');
    expect(await readFile(path.join(store.dir(imported.id), imported.sources[0].asset!))).toEqual(original);
    const ppt = unzipSync(await readFile(result.pptx));
    const slides = Object.keys(ppt).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => strFromU8(ppt[name]));
    expect(slides.join()).toContain('第 21 题');
    expect(slides.join()).toContain('to shade the playground');
    expect(slides.join()).toContain('词汇手账 · shade');
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
    const manifest = {selection: [{groupId: 'g1', module: 'source'}, {groupId: 'g1', questionId: 'q7', module: 'analysis'}],
      project: {title: '现代文讲评', subject: 'chinese',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'text', blocks: [{id: 'b1', text: original}]},
        {id: 'key', name: '答案', role: 'answer', kind: 'text', blocks: [{id: 'a7', text: '第 7 题：雨后安静。'}]}],
      review: {coverage: 'partial', checkedQuestionIds: ['q7'], limitations: ['原页图待人工确认'], findings: []},
      groups: [{id: 'g1', section: '现代文阅读', title: '雨后', kind: 'literature',
        materials: [{id: 'm1', title: '雨后原文', text: original, sourceId: 'paper', blockIds: ['b1'], imageFile: 'page.png'}],
        questions: [{id: 'q7', number: '7', stem: '末句表现了怎样的环境？', format: 'short', materialIds: ['m1'], answer: '雨后安静。',
          answerEvidence: {sourceId: 'key', blockId: 'a7', quote: '第 7 题：雨后安静。'}}],
        versions: [{module: 'analysis', questionId: 'q7', result: {status: 'ok', notices: [], blocks: [
          {label: '分析', text: '滴水声衬托雨后的安静。', evidence: [{materialId: 'm1', quote: '屋檐还在滴水'}]},
        ]}}],
      }],
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'));
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    const group = imported.chinese!.groups[0];
    expect(imported.chinese?.review?.result.checkedQuestionIds).toEqual(['q7']);
    expect(group.versions[0]).toMatchObject({confirmed: false, questionId: 'q7'});
    expect(group.materials[0].imageConfirmed).toBe(false);
    group.materials[0].imageConfirmed = true;
    group.questions[0].confirmed = true;
    group.versions[0].confirmed = true;
    expect(chineseAvailable(imported.chinese!, group, group.versions[0])).toBe(true);
    const ppt = unzipSync(await readFile(result.pptx));
    expect(strFromU8(ppt['ppt/slides/slide4.xml'])).toContain('雨后安静。');
    expect(strFromU8(ppt['ppt/slides/slide4.xml'])).toContain('屋檐还在滴水');
    const {answerEvidence: _answerEvidence, ...q7} = manifest.project.groups[0].questions[0];
    const trial = {project: {...manifest.project, groups: [{...manifest.project.groups[0],
      questions: [{...q7, answer: '', trialAnswer: '雨后安静。'}]}]}};
    const trialResult = await buildSkillLesson(trial, root, path.join(root, 'trial'), false, true);
    const pending = await new Store(path.join(root, 'trial-imported')).unpack(await readFile(trialResult.bundle));
    expect(pending.chinese!.groups[0].versions[0]).toMatchObject({confirmed: false, result: {status: 'needs_review'}});
    await expect(buildSkillLesson({...trial, selection: manifest.selection}, root, path.join(root, 'trial-ppt')))
      .rejects.toThrow(/第 7 题.*待核对试解/);
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
    const manifest = {selection: [{questionId: 'q4', module: 'source'}, {questionId: 'q4', module: 'analysis'}],
      project: {title: '化学反应讲评', subject: 'chemistry',
      sources: [{id: 'paper', name: '原卷', role: 'paper', kind: 'text', blocks: [{id: 'b1', text: '写出氢气燃烧的化学方程式。'}]}],
      review: {coverage: 'partial', checkedQuestionIds: ['q4'], limitations: ['报告记录文字校对范围'], findings: []},
      questions: [{id: 'q4', number: '4', stem: '写出氢气燃烧的化学方程式。', answer: '$\\ce{2H2 + O2 -> 2H2O}$', answerOrigin: 'teacher', sourceId: 'paper', imageMode: 'vision',
        images: [{id: 'i1', name: '原题图', file: 'figure.png'}],
        versions: [{module: 'analysis', result: {status: 'ok', notices: [], blocks: [{label: '方程式', text: '$\\ce{2H2 + O2 -> 2H2O}$'}]}}],
      }],
    }};
    const result = await buildSkillLesson(manifest, root, path.join(root, 'output'), true);
    const imported = await new Store(path.join(root, 'imported')).unpack(await readFile(result.bundle));
    const question = imported.chemistry!.questions[0];
    expect(imported.chemistry?.review?.snapshot).toBe(chemistryReviewSnapshot(imported));
    expect(question.confirmed).toBe(true);
    expect(question.versions[0].confirmed).toBe(true);
    expect(Buffer.from(question.images[0].data.split(',')[1], 'base64')).toEqual(image);
    const ppt = unzipSync(await readFile(result.pptx));
    expect(Object.keys(ppt).some(part => /^ppt\/media\/.*\.svg$/.test(part))).toBe(true);
    expect(Object.entries(ppt).some(([part, bytes]) => /^ppt\/media\/.*\.png$/.test(part) && Buffer.from(bytes).equals(image))).toBe(true);
    const {answerOrigin: _answerOrigin, ...q4} = manifest.project.questions[0];
    const trial = {project: {...manifest.project, questions: [{...q4, answer: '', trialAnswer: q4.answer}]}};
    const trialResult = await buildSkillLesson(trial, root, path.join(root, 'trial'), false, true);
    const pending = await new Store(path.join(root, 'trial-imported')).unpack(await readFile(trialResult.bundle));
    expect(pending.chemistry!.questions[0].versions[0]).toMatchObject({confirmed: false, result: {status: 'needs_review'}});
    await expect(buildSkillLesson({...trial, selection: manifest.selection}, root, path.join(root, 'trial-ppt')))
      .rejects.toThrow(/第 4 题.*待核对试解/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
