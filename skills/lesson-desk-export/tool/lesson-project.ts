import {z} from 'zod';
import {emptyProject, passageSchema, projectSchema, questionSchema, sourceSchema, uid, type Project} from '../../../src/core/model';
import {resolveEvidence} from '../../../src/core/evidence';
import {exerciseSchema, validateExercise} from '../../../src/core/exercise';
import {emptyTeaching, teachingSchema, transferFromExercise, validateTeachingCore, type TeachingModule} from '../../../src/core/learning';
import {bindLexiconEntries, lexiconGenerationSchema} from '../../../src/core/teaching-quality';
import {questionExercise, teachingSource} from '../../../src/core/logic';
import {applicableChineseModules, chineseFingerprint, chineseGroupSchema, chineseReviewSchema, validateChineseResult} from '../../../src/core/chinese';
import {chemFingerprint, chemImageSchema, chemModules, chemQuestionSchema, chemResultSchema, chemistryReviewSchema} from '../../../src/core/chemistry';
import {sourceFigureSchema} from '../../../src/core/chemistry-figures';
import {specialFingerprint, specialInputSchema, specialKinds, specialNames, specialSchemas} from '../../../src/core/special';
import {prepareSpecial, validateSpecialResult} from '../../../src/core/special-workflow';
import {correctionPlanSchema} from '../../../src/core/correction';
import {mergedProofreadResultSchema} from '../../../src/core/proofread';
import {GenerationContentError} from '../../../src/core/errors';
import {answerFields, checkSkillAnswer} from './skill-answer';
import {selectionEntrySchema} from './skill-selection';

const text = z.string().trim().min(1);
const sourceInput = sourceSchema.pick({id: true, name: true, role: true, kind: true, blocks: true, pageCount: true}).extend({
  ocr: z.array(z.object({page: z.number().int().min(1).max(100), blank: z.boolean().default(false), uncertain: z.array(text).default([])})).optional(),
  figures: z.array(sourceFigureSchema.omit({data: true}).extend({file: text})).optional(),
});
const evidence = z.object({blockId: text, quote: text});
const analysis = z.object({answer: text, text, evidence: z.array(evidence).default([]), practice: exerciseSchema.optional()});
const englishQuestion = questionSchema.omit({confirmed: true, stale: true, excluded: true, versions: true, activeVersion: true}).extend({
  stem: text, answer: z.string().default(''), options: z.array(z.string()).default([]), excluded: z.boolean().default(false), analysis: analysis.optional(),
  practice: exerciseSchema.optional(), ...answerFields,
});
const specialInput = z.union(specialKinds.map(kind => z.object({
  kind: z.literal(kind), input: specialInputSchema, result: specialSchemas[kind],
})));
const englishPassage = passageSchema.omit({translationSource: true, learning: true, special: true}).extend({
  teaching: z.object({modules: z.array(z.enum(['sentences', 'structure', 'lexicon', 'imitation'])).min(1), data: teachingSchema}).optional(),
  lexicon: z.array(lexiconGenerationSchema.element.omit({sourceCitationId: true}).extend({evidence})).min(1).max(20).optional(),
  special: specialInput.optional(),
});
const chineseMaterial = chineseGroupSchema.shape.materials.element.omit({image: true, imageConfirmed: true}).extend({imageFile: text.optional()});
const chineseGroup = chineseGroupSchema.omit({materials: true, versions: true}).extend({
  materials: z.array(chineseMaterial),
  questions: z.array(chineseGroupSchema.shape.questions.element.omit({answerSource: true, confirmed: true}).extend(answerFields)),
  versions: z.array(chineseGroupSchema.shape.versions.removeDefault().element.pick({module: true, questionId: true, result: true})).default([]),
});
const chemistryQuestion = chemQuestionSchema.omit({images: true, versions: true, confirmed: true}).extend({
  stem: text, ...answerFields,
  images: z.array(chemImageSchema.omit({data: true, confirmed: true, automatic: true}).extend({file: text})).max(12).default([]),
  versions: z.array(z.object({module: z.enum(chemModules), result: chemResultSchema})).default([]),
});
export const manifestSchema = z.object({
  project: z.discriminatedUnion('subject', [
    z.object({title: text, subject: z.literal('english'), sources: z.array(sourceInput), passages: z.array(englishPassage), questions: z.array(englishQuestion),
      review: z.object({includeExplanations: z.boolean().default(false), result: mergedProofreadResultSchema}).optional(),
      correction: z.object({includeExplanations: z.boolean().default(false), plan: correctionPlanSchema}).optional(),
    }),
    z.object({title: text, subject: z.literal('chinese'), sources: z.array(sourceInput), groups: z.array(chineseGroup), review: chineseReviewSchema.optional()}),
    z.object({title: text, subject: z.literal('chemistry'), sources: z.array(sourceInput), questions: z.array(chemistryQuestion), review: chemistryReviewSchema.optional()}),
  ]),
  assets: z.record(z.string(), text).default({}),
  reviewNotes: z.array(text).default([]),
  selection: z.array(selectionEntrySchema).min(1).optional(),
});

export type SkillManifest = z.infer<typeof manifestSchema>;
type LoadImage = (file: string) => Promise<string>;

export function parseManifest(raw: unknown): SkillManifest {
  const parsed = manifestSchema.parse(raw);
  const unknownKeys: z.core.$ZodIssueUnrecognizedKeys[] = [];
  function checkKeys(input: unknown, output: unknown, path: (string | number)[]) {
    if (Array.isArray(input) && Array.isArray(output)) {
      input.forEach((item, index) => checkKeys(item, output[index], [...path, index]));
    } else if (input && output && typeof input === 'object' && typeof output === 'object') {
      const record = output as Record<string, unknown>;
      const keys = Object.keys(input).filter(key => !Object.hasOwn(record, key));
      if (keys.length) unknownKeys.push({code: 'unrecognized_keys', keys, path,
        message: '清单存在未知字段 ' + keys.map(key => [...path, key].join('.')).join('、')});
      for (const [key, value] of Object.entries(input)) if (Object.hasOwn(record, key)) checkKeys(value, record[key], [...path, key]);
    }
  }
  checkKeys(raw, parsed, []);
  if (unknownKeys.length) throw new z.ZodError(unknownKeys);
  return parsed;
}

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw Error(`${label}重复，请使用唯一标识`);
}

export async function prepareLesson(manifest: SkillManifest, loadImage: LoadImage, teacherReviewed: boolean) {
  const input = manifest.project;
  const project = emptyProject(input.title, input.subject);
  const issues = [...manifest.reviewNotes];
  project.sources = await Promise.all(input.sources.map(async ({ocr, figures, ...source}) => {
    unique(source.blocks.map(block => block.id), source.name + ' 的原文块 ID');
    if (figures?.length && (input.subject !== 'chemistry' || source.role !== 'paper' || source.kind === 'text'))
      throw Error(`${source.name}：题图候选需要化学原卷 PDF 或 Word`);
    if (figures) unique(figures.map(figure => figure.id), `${source.name} 的题图 ID`);
    const prepared = {...source, figures: figures && await Promise.all(figures.map(async ({file, ...figure}) => {
      const {x, y, width, height} = figure.box;
      if (x + width > 1000 || y + height > 1000) throw Error(`${figure.name}：题图坐标超出原页`);
      if (source.kind === 'pdf' && (!figure.page || figure.page !== figure.unit || source.pageCount && figure.page > source.pageCount))
        throw Error(`${figure.name}：题图页码或原页单元无效`);
      return {...figure, data: await loadImage(file)};
    }))};
    if (!ocr?.length) return prepared;
    if (source.kind !== 'pdf' || !source.pageCount) throw Error(`${source.name}：OCR 结果需要原 PDF 和总页数`);
    unique(ocr.map(page => String(page.page)), `${source.name} 的 OCR 页码`);
    const ocrTranscriptions = ocr.map(({page, blank, uncertain}) => {
      if (page > source.pageCount!) throw Error(`${source.name}：OCR 页码 ${page} 超出总页数`);
      const blocks = source.blocks.filter(block => block.page === page).map(block => block.text).filter(line => line.trim());
      if (blank === !!blocks.length) throw Error(`${source.name} 第 ${page} 页：空白状态与 OCR 转录不符`);
      if (!teacherReviewed) issues.push(`${source.name} 第 ${page} 页：请对照原图核对识别文字`);
      issues.push(...uncertain.map(note => `${source.name} 第 ${page} 页：${note}`));
      return {page, at: project.updatedAt, blocks, uncertain};
    });
    return {...prepared, ocrTranscriptions,
      ocrReviewPages: ocr.filter(page => !teacherReviewed || page.uncertain.length).map(page => page.page),
      ocrVerifiedPages: ocr.filter(page => teacherReviewed && !page.uncertain.length).map(page => page.page),
    };
  }));
  unique(project.sources.map(s => s.id), '来源 ID');
  if (!project.sources.some(s => s.role === 'paper')) throw Error('缺少原试卷来源');
  const checkSource = (id: string | undefined, context: string) => {
    if (id && !project.sources.some(s => s.id === id)) throw Error(`${context}：找不到来源 ${id}`);
  };
  const pendingAnswer = (number: string, trialAnswer: string | undefined) => {
    issues.push('第 ' + number + ' 题：' + (trialAnswer ? '待核对试解 · ' + trialAnswer : '缺少已核实的参考答案'));
  };

  if (input.subject === 'english') {
    unique(input.passages.map(p => p.id), '篇目 ID');
    unique(input.questions.map(q => q.id), '题目 ID');
    unique(input.questions.map(q => q.number), '题号');
    project.passages = input.passages.map(({teaching: _teaching, lexicon: _lexicon, special: _special, ...passage}) => passage);
    const practices = new Map<string, NonNullable<ReturnType<typeof transferFromExercise>['exercise']>>();
    for (const authored of input.questions) {
      checkSkillAnswer(project, authored, teacherReviewed);
      const {analysis: notes, practice, answerEvidence: _answerEvidence, answerOrigin: _answerOrigin, trialAnswer, ...question} = authored;
      const passage = project.passages.find(p => p.id === question.passageId);
      if (!passage) throw Error(`第 ${question.number} 题：篇目不存在`);
      checkSource(question.sourceId, `第 ${question.number} 题`);
      const answer = question.answer.trim();
      const writing = question.type === 'writing' || question.type === 'continuation';
      if (trialAnswer && (!notes || notes.answer.trim() !== trialAnswer)) {
        throw new GenerationContentError('第 ' + question.number + ' 题：待核对试解需要与逐题解析中的答案一致');
      }
      const needsAnswer = !!trialAnswer || !answer && !writing && !!notes;
      const conflict = needsAnswer || !!(answer && notes && notes.answer.trim() !== answer);
      if (needsAnswer) pendingAnswer(question.number, trialAnswer);
      else if (question.excluded || conflict) issues.push(`第 ${question.number} 题：${question.excluded ? '待核实，已排除' : '解析与参考答案有冲突，待核实'}`);
      const version = notes && {
        id: uid(), createdAt: project.updatedAt, origin: 'ai' as const, answer: notes.answer, analysis: notes.text,
        evidence: notes.evidence.map(reference => resolveEvidence(passage.paragraphs, reference)),
        practice: '', practiceAnswer: '', conflict, exercise: notes.practice,
      };
      const original = [...passage.paragraphs.map(p => p.text), passage.pool, question.stem, ...question.options];
      if (practice && notes?.practice) throw Error(`第 ${question.number} 题：请只提供一份考点演练`);
      if (notes?.practice) validateExercise(notes.practice, question.type, original);
      if (practice) practices.set(question.id, validateExercise(practice, question.type, original));
      const excluded = question.excluded || conflict;
      project.questions.push({...question, excluded, confirmed: teacherReviewed && !excluded && !!(answer || writing || practice),
        stale: false, versions: version ? [version] : [], activeVersion: version?.id});
    }
    for (const [index, passage] of project.passages.entries()) {
      unique(passage.paragraphs.map(p => p.id), `${passage.title}的段落 ID`);
      const sourceText = teachingSource(project, passage.id);
      if (passage.translation) passage.translationSource = sourceText;
      const {teaching, lexicon} = input.passages[index];
      const transfer = project.questions.filter(q => q.passageId === passage.id && !q.excluded && practices.has(q.id))
        .map(q => ({...transferFromExercise(practices.get(q.id)!), questionId: q.id}));
      if (!teaching && !lexicon && !transfer.length) continue;
      const modules: TeachingModule[] = [...new Set(teaching?.modules)];
      const data = teaching?.data ?? emptyTeaching();
      if (lexicon) {
        if (modules.includes('lexicon') || data.lexicon.length) throw Error(`${passage.title}：词汇手账重复提供，请只填写篇目的 lexicon 或旧版 teaching.data.lexicon`);
        data.lexicon = bindLexiconEntries(lexicon, word => resolveEvidence(passage.paragraphs, word.evidence).quote);
        modules.push('lexicon');
      }
      validateTeachingCore(data, passage.paragraphs, modules);
      if (transfer.length) modules.push('transfer');
      const id = uid();
      passage.learning = {stale: false, activeVersion: id, remembered: [], versions: [{id, createdAt: project.updatedAt, origin: 'ai', sourceText, formatVersion: 3, completedModules: modules, data: {...data, transfer}}]};
    }
    if (input.passages.some(p => p.special)) {
      const ready = teacherReviewed ? project : preparePreview(project);
      for (const authored of input.passages) {
        if (!authored.special) continue;
        const {kind, input: scope, result: raw} = authored.special;
        if (['option_evidence', 'cohesion', 'cloze_chain'].includes(kind) &&
            ready.questions.some(q => scope.questionIds.includes(q.id) && !q.answer.trim())) {
          throw new GenerationContentError(authored.title + '：所选题目的专项讲评需要已核实的参考答案');
        }
        const prepared = prepareSpecial(ready, authored.id, kind, scope);
        if (new Set(scope.questionIds).size !== scope.questionIds.length || scope.questionIds.length !== prepared.questions.length)
          throw Error(`${authored.title}：专项讲评包含无效、重复或已排除的题目`);
        const result = validateSpecialResult(prepared, raw);
        if (result.status !== 'ok') issues.push(`${authored.title} · ${specialNames[kind]}：待核实。 ${result.notices.join('；')}`);
        const id = uid(), target = project.passages.find(p => p.id === authored.id)!;
        target.special = {active: {[kind]: id}, versions: [{id, kind, input: scope, result, createdAt: project.updatedAt, sourceText: specialFingerprint(ready, target.id)}]};
      }
    }
  } else if (input.subject === 'chinese') {
    const data = project.chinese!;
    unique(input.groups.map(g => g.id), '材料组 ID');
    unique(input.groups.flatMap(g => g.materials.map(m => m.id)), '材料 ID');
    unique(input.groups.flatMap(g => g.questions.map(q => q.id)), '题目 ID');
    unique(input.groups.flatMap(g => g.questions.map(q => q.number)), '题号');
    for (const {versions: _versions, ...group} of input.groups) {
      const materials = await Promise.all(group.materials.map(async ({imageFile, ...material}) => {
        checkSource(material.sourceId, material.title);
        const source = project.sources.find(s => s.id === material.sourceId);
        if (material.blockIds.some(id => !source?.blocks.some(b => b.id === id))) throw Error(`${material.title}：原文块不存在`);
        return {...material, image: imageFile ? await loadImage(imageFile) : undefined, imageConfirmed: !!imageFile && teacherReviewed && !group.sourceNeedsReview};
      }));
      const questions = group.questions.map(authored => {
        checkSkillAnswer(project, authored, teacherReviewed);
        const {answerEvidence: _answerEvidence, answerOrigin, trialAnswer, ...q} = authored;
        if (trialAnswer) pendingAnswer(q.number, trialAnswer);
        return {...q, answerSource: answerOrigin ?? (q.answer.trim() ? 'provided' as const : 'none' as const), confirmed: teacherReviewed && !group.sourceNeedsReview && !q.excluded};
      });
      data.groups.push(chineseGroupSchema.parse({...group, materials, questions, versions: []}));
    }
    const materialIds = new Set(data.groups.flatMap(g => g.materials.map(m => m.id)));
    // Fingerprint the unchanged source after the teacher has verified its images.
    // The saved image and lesson confirmation flags themselves remain unset in a draft.
    const reviewedSources = {...data, groups: data.groups.map(group => ({
      ...group, materials: group.materials.map(m => ({...m, imageConfirmed: !!m.image && !group.sourceNeedsReview})),
    }))};
    for (const [index, group] of data.groups.entries()) {
      for (const q of group.questions) {
        if (!q.stem.trim() || q.materialIds.some(id => !materialIds.has(id))) throw Error(`第 ${q.number} 题：题干为空或材料 ID 不存在`);
        if (q.excluded) issues.push(`第 ${q.number} 题：待核实，已排除`);
      }
      const authored = input.groups[index];
      for (const notes of authored.versions) {
        const q = group.questions.find(q => q.id === notes.questionId);
        if (!applicableChineseModules(group).includes(notes.module) || (notes.questionId || ['analysis', 'practice'].includes(notes.module)) && !q) throw Error(`${group.title}：讲义模块或题目 ID 不适用`);
        const questionInput = authored.questions.find(item => item.id === q?.id);
        const answerPending = notes.module === 'analysis' && q && !q.answer.trim() && (q.format !== 'essay' || questionInput?.trialAnswer);
        const approved = notes.result.status === 'ok' && !group.sourceNeedsReview && !q?.excluded && !answerPending;
        if (!approved) issues.push(`${group.title}${q ? ` · 第 ${q.number} 题` : ''} · ${notes.module}：待核实`);
        const output = answerPending && notes.result.status === 'ok'
          ? {...notes.result, status: 'needs_review' as const, notices: [...notes.result.notices, '待补充或确认参考答案']}
          : notes.result;
        const result = validateChineseResult(data, {...group, materials: group.materials.map(m => ({...m, imageConfirmed: true}))}, output);
        group.versions.push({...notes, id: uid(), createdAt: project.updatedAt, fingerprint: chineseFingerprint(reviewedSources, reviewedSources.groups[index], notes.questionId), confirmed: teacherReviewed && approved, result});
      }
    }
  } else {
    unique(input.questions.map(q => q.id), '化学题目 ID');
    unique(input.questions.map(q => q.number), '化学题号');
    for (const authored of input.questions) {
      checkSkillAnswer(project, authored, teacherReviewed);
      const {images: imageFiles, versions, answerEvidence: _answerEvidence, answerOrigin: _answerOrigin, trialAnswer, ...question} = authored;
      if (trialAnswer) pendingAnswer(question.number, trialAnswer);
      checkSource(question.sourceId, `第 ${question.number} 题`);
      const images = await Promise.all(imageFiles.map(async ({file, ...image}) => {
        checkSource(image.sourceId, image.name);
        return {...image, data: await loadImage(file), confirmed: teacherReviewed && !question.excluded};
      }));
      const q = {...question, images, confirmed: teacherReviewed && !question.excluded, versions: [] as NonNullable<Project['chemistry']>['questions'][number]['versions']};
      if (q.excluded) issues.push(`第 ${q.number} 题：待核实，已排除`);
      for (const notes of versions) {
        const result = notes.module === 'analysis' && !q.answer.trim() && notes.result.status === 'ok'
          ? {...notes.result, status: 'needs_review' as const, notices: [...notes.result.notices, '待补充或确认参考答案']}
          : notes.result;
        if (result.status !== 'ok') issues.push(`第 ${q.number} 题 · ${notes.module}：待核实`);
        q.versions.push({...notes, result, id: uid(), createdAt: project.updatedAt, origin: 'ai', fingerprint: chemFingerprint(q), confirmed: teacherReviewed && !q.excluded && result.status === 'ok'});
      }
      project.chemistry!.questions.push(q);
    }
  }
  const reviewIssues = [...new Set(issues)];
  if (reviewIssues.length) {
    if (project.subject === 'chinese') project.chinese!.organizationIssues = reviewIssues;
    else project.organizationIssues = reviewIssues;
  }
  return {project: projectSchema.parse(project), issues: reviewIssues};
}

// Only the isolated copy used to render a teacher-review PPT receives these flags.
export function preparePreview(project: Project): Project {
  const preview = structuredClone(project);
  preview.title += '（待教师核对）';
  for (const q of preview.questions) q.confirmed = !q.excluded && !q.versions.some(v => v.conflict) &&
    !!(q.answer.trim() || ['writing', 'continuation'].includes(q.type) || questionExercise(preview, q));
  for (const group of preview.chinese?.groups || []) {
    for (const m of group.materials) m.imageConfirmed = !!m.image && !group.sourceNeedsReview;
    for (const q of group.questions) q.confirmed = !q.excluded && !group.sourceNeedsReview;
    for (const v of group.versions) v.confirmed = v.result.status === 'ok' && !group.sourceNeedsReview;
  }
  for (const q of preview.chemistry?.questions || []) {
    q.confirmed = !q.excluded;
    for (const image of q.images) image.confirmed = !q.excluded;
    for (const v of q.versions) v.confirmed = v.result.status === 'ok' && !q.excluded;
  }
  return preview;
}
