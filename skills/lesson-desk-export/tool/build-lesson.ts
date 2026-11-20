import {copyFile, mkdir, mkdtemp, readFile, realpath, rm, rmdir, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {strToU8, zipSync} from 'fflate';
import {defaultLessonSelection, type LessonSelection} from '../../../src/core/lesson-deck';
import {defaultChineseLessonSelection, resolveChineseLessonSelection} from '../../../src/core/chinese-lesson-selection';
import {defaultChemSelection, resolveChemSelection} from '../../../src/core/chemistry-workflow';
import {exportPpt} from '../../../src/desktop/export';
import {parseManifest, prepareLesson, preparePreview} from './lesson-project';

const maxBundle = 200 * 1024 * 1024;
const maxImage = 10 * 1024 * 1024;

export async function buildSkillLesson(raw: unknown, inputDirectory: string, outputDirectory: string, teacherReviewed = false) {
  const manifest = parseManifest(raw);
  const input = await realpath(inputDirectory);
  async function readInput(file: string, limit: number) {
    if (path.isAbsolute(file) || path.win32.isAbsolute(file)) throw Error(`请用输入目录内的文件相对路径 ${file}`);
    const resolved = await realpath(path.resolve(input, file));
    const relative = path.relative(input, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error(`文件超出输入目录 ${file}`);
    const info = await stat(resolved);
    if (!info.isFile() || info.size > limit) throw Error(`文件无效或超过大小限制 ${file}`);
    return readFile(resolved);
  }
  const {project, issues} = await prepareLesson(manifest, async file => {
    const bytes = await readInput(file, maxImage);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (!png && !jpeg) throw Error(`请提供原卷裁出的 PNG 或 JPEG 图片 ${file}`);
    return `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;
  }, teacherReviewed);

  const files: Record<string, Uint8Array> = {};
  let bytes = 0;
  for (const [id, file] of Object.entries(manifest.assets)) {
    const source = project.sources.find(s => s.id === id);
    if (!source || source.kind === 'text' || !/^[a-zA-Z0-9_-]+$/.test(id)) throw Error(`原件附件 ID 或类型无效 ${id}`);
    if (path.extname(file).toLowerCase() !== `.${source.kind}`) throw Error(`附件与来源格式不一致 ${file}`);
    const contents = await readInput(file, maxBundle - bytes);
    bytes += contents.length;
    source.asset = `sources/${id}.${source.kind}`;
    files[source.asset] = contents;
  }
  for (const source of project.sources) if (source.kind !== 'text' && !source.asset) throw Error(`缺少原文件 ${source.name}`);
  files['project.json'] = strToU8(JSON.stringify(project));
  if (bytes + files['project.json'].length > maxBundle) throw Error('课件包解压体积超过 200 MB，请缩小本次范围');
  const archive = zipSync(files, {level: 6});
  if (archive.length > maxBundle || Object.keys(files).length > 1000) throw Error('课件包超过导入限制，请缩小本次范围');

  const preview = teacherReviewed ? project : preparePreview(project);
  let selection: LessonSelection | string[];
  if (preview.subject === 'english') {
    selection = defaultLessonSelection(preview);
  } else {
    const resolved = preview.subject === 'chinese'
      ? resolveChineseLessonSelection(preview.chinese!, defaultChineseLessonSelection(preview.chinese!))
      : resolveChemSelection(preview.chemistry!, defaultChemSelection(preview.chemistry!));
    if (resolved.issues.length) throw Error(resolved.issues.join('；'));
    selection = resolved.ids;
  }
  const out = path.resolve(outputDirectory);
  const stage = await mkdtemp(path.join(os.tmpdir(), 'lesson-desk-skill-'));
  const draft = path.join(stage, 'lesson.pptx');
  try {
    const pages = await exportPpt(preview, draft, selection);
    const pptx = path.join(out, teacherReviewed ? '讲评课件.pptx' : '讲评课件-待核对.pptx');
    const bundle = path.join(out, '讲评课件.lesson.zip');
    const review = path.join(out, '核对清单.md');
    const reviewText = [
      '# 课件核对清单', '', project.title, '',
      teacherReviewed ? '本次按教师确认状态生成。' : 'PPT 为待教师核对稿。课件包中的题面、题图和需要教师确认的讲义仍保留待核对状态。',
      '', ...issues.map(item => `- ${item}`), '',
    ].join('\n');
    await mkdir(out);
    try {
      await copyFile(draft, pptx);
      await writeFile(bundle, archive);
      await writeFile(review, reviewText, 'utf8');
    } catch (error) {
      await Promise.all([pptx, bundle, review].map(file => rm(file, {force: true})));
      await rmdir(out);
      throw error;
    }
    return {pptx, bundle, review, pages, issues};
  } finally {
    await rm(draft, {force: true});
    await rmdir(stage);
  }
}
