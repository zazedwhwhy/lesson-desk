import {z} from 'zod';
import {emptyProject, passageSchema, projectSchema, questionSchema, sourceSchema, uid, type Project} from '../../../src/core/model';
import {resolveEvidence} from '../../../src/core/evidence';
import {exerciseSchema, validateExercise} from '../../../src/core/exercise';
import {emptyTeaching, teachingSchema, validateTeachingCore, type TeachingModule} from '../../../src/core/learning';
import {bindLexiconEntries, lexiconGenerationSchema} from '../../../src/core/teaching-quality';
import {teachingSource} from '../../../src/core/logic';
import {applicableChineseModules, chineseFingerprint, chineseGroupSchema, validateChineseResult} from '../../../src/core/chinese';
import {chemFingerprint, chemImageSchema, chemModules, chemQuestionSchema, chemResultSchema} from '../../../src/core/chemistry';

const text = z.string().trim().min(1);
const sourceInput = sourceSchema.pick({id: true, name: true, role: true, kind: true, blocks: true, pageCount: true});
const evidence = z.object({blockId: text, quote: text});
const analysis = z.object({answer: text, text, evidence: z.array(evidence).default([]), practice: exerciseSchema.optional()});
const englishQuestion = questionSchema.omit({confirmed: true, stale: true, excluded: true, versions: true, activeVersion: true}).extend({
  stem: text, answer: z.string().default(''), options: z.array(z.string()).default([]), excluded: z.boolean().default(false), analysis: analysis.optional(),
});
const englishPassage = passageSchema.omit({translationSource: true, learning: true, special: true}).extend({
  teaching: z.object({modules: z.array(z.enum(['sentences', 'structure', 'lexicon', 'imitation'])).min(1), data: teachingSchema}).optional(),
  lexicon: z.array(lexiconGenerationSchema.element.omit({sourceCitationId: true}).extend({evidence})).min(1).max(20).optional(),
});
const chineseMaterial = chineseGroupSchema.shape.materials.element.omit({image: true, imageConfirmed: true}).extend({imageFile: text.optional()});
const chineseGroup = chineseGroupSchema.omit({materials: true, versions: true}).extend({
  materials: z.array(chineseMaterial),
  versions: z.array(chineseGroupSchema.shape.versions.removeDefault().element.pick({module: true, questionId: true, result: true})).default([]),
});
const chemistryQuestion = chemQuestionSchema.omit({images: true, versions: true, confirmed: true}).extend({
  stem: text,
  images: z.array(chemImageSchema.omit({data: true, confirmed: true, automatic: true}).extend({file: text})).max(12).default([]),
  versions: z.array(z.object({module: z.enum(chemModules), result: chemResultSchema})).default([]),
});
const manifestSchema = z.object({
  project: z.discriminatedUnion('subject', [
    z.object({title: text, subject: z.literal('english'), sources: z.array(sourceInput), passages: z.array(englishPassage), questions: z.array(englishQuestion)}),
    z.object({title: text, subject: z.literal('chinese'), sources: z.array(sourceInput), groups: z.array(chineseGroup)}),
    z.object({title: text, subject: z.literal('chemistry'), sources: z.array(sourceInput), questions: z.array(chemistryQuestion)}),
  ]),
  assets: z.record(z.string(), text).default({}),
  reviewNotes: z.array(text).default([]),
});

export type SkillManifest = z.infer<typeof manifestSchema>;
type LoadImage = (file: string) => Promise<string>;

export function parseManifest(raw: unknown): SkillManifest {
  return manifestSchema.parse(raw);
}

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw Error(`${label}重复，请使用唯一标识`);
}

export async function prepareLesson(manifest: SkillManifest, loadImage: LoadImage, teacherReviewed: boolean) {
  const input = manifest.project;
  const project = emptyProject(input.title, input.subject);
  const issues = [...manifest.reviewNotes];
  project.sources = input.sources;
  unique(project.sources.map(s => s.id), '来源 ID');
  if (!project.sources.some(s => s.role === 'paper')) throw Error('缺少原试卷来源');
  const checkSource = (id: string | undefined, context: string) => {
    if (id && !project.sources.some(s => s.id === id)) throw Error(`${context}：找不到来源 ${id}`);
  };

  if (input.subject === 'english') {
    unique(input.passages.map(p => p.id), '篇目 ID');
    unique(input.questions.map(q => q.id), '题目 ID');
    unique(input.questions.map(q => q.number), '题号');
    project.passages = input.passages.map(({teaching: _teaching, lexicon: _lexicon, ...passage}) => passage);
    for (const {analysis: notes, ...question} of input.questions) {
      const passage = project.passages.find(p => p.id === question.passageId);
      if (!passage) throw Error(`第 ${question.number} 题：篇目不存在`);
      checkSource(question.sourceId, `第 ${question.number} 题`);
      const conflict = !question.answer.trim() || !!notes && notes.answer.trim() !== question.answer.trim();
      if (question.excluded || conflict || !notes) issues.push(`第 ${question.number} 题：${question.excluded ? '待核实，已排除' : conflict ? '缺参考答案或解析与参考答案有冲突' : '缺少解析'}`);
      const version = notes && {
        id: uid(), createdAt: project.updatedAt, origin: 'ai' as const, answer: notes.answer, analysis: notes.text,
        evidence: notes.evidence.map(reference => resolveEvidence(passage.paragraphs, reference)),
        practice: '', practiceAnswer: '', conflict, exercise: notes.practice,
      };
      if (notes?.practice) validateExercise(notes.practice, question.type, [...passage.paragraphs.map(p => p.text), question.stem, ...question.options]);
      const excluded = question.excluded || conflict;
      project.questions.push({...question, excluded, confirmed: teacherReviewed && !excluded, stale: false, versions: version ? [version] : [], activeVersion: version?.id});
    }
    for (const [index, passage] of project.passages.entries()) {
      unique(passage.paragraphs.map(p => p.id), `${passage.title}的段落 ID`);
      const sourceText = teachingSource(project, passage.id);
      if (passage.translation) passage.translationSource = sourceText;
      const {teaching, lexicon} = input.passages[index];
      if (!teaching && !lexicon) continue;
      const modules: TeachingModule[] = [...new Set(teaching?.modules)];
      const data = teaching?.data ?? emptyTeaching();
      if (lexicon) {
        if (modules.includes('lexicon') || data.lexicon.length) throw Error(`${passage.title}：词汇手账重复提供，请只填写篇目的 lexicon 或旧版 teaching.data.lexicon`);
        data.lexicon = bindLexiconEntries(lexicon, word => resolveEvidence(passage.paragraphs, word.evidence).quote);
        modules.push('lexicon');
      }
      validateTeachingCore(data, passage.paragraphs, modules);
      const id = uid();
      passage.learning = {stale: false, activeVersion: id, remembered: [], versions: [{id, createdAt: project.updatedAt, origin: 'ai', sourceText, formatVersion: 3, completedModules: modules, data: {...data, transfer: []}}]};
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
      const questions = group.questions.map(q => ({...q, answerSource: q.answer.trim() ? 'provided' as const : 'none' as const, confirmed: teacherReviewed && !group.sourceNeedsReview && !q.excluded}));
      data.groups.push({...group, materials, questions, versions: []});
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
      for (const notes of input.groups.find(g => g.id === group.id)!.versions) {
        const q = group.questions.find(q => q.id === notes.questionId);
        if (!applicableChineseModules(group).includes(notes.module) || (notes.questionId || ['analysis', 'practice'].includes(notes.module)) && !q) throw Error(`${group.title}：讲义模块或题目 ID 不适用`);
        const approved = notes.result.status === 'ok' && !group.sourceNeedsReview && !q?.excluded;
        if (!approved) issues.push(`${group.title}${q ? ` · 第 ${q.number} 题` : ''} · ${notes.module}：待核实`);
        const result = validateChineseResult(data, {...group, materials: group.materials.map(m => ({...m, imageConfirmed: true}))}, notes.result);
        group.versions.push({...notes, id: uid(), createdAt: project.updatedAt, fingerprint: chineseFingerprint(reviewedSources, reviewedSources.groups[index], notes.questionId), confirmed: teacherReviewed && approved, result});
      }
    }
  } else {
    for (const {images: imageFiles, versions, ...question} of input.questions) {
      checkSource(question.sourceId, `第 ${question.number} 题`);
      const images = await Promise.all(imageFiles.map(async ({file, ...image}) => {
        checkSource(image.sourceId, image.name);
        return {...image, data: await loadImage(file), confirmed: teacherReviewed && !question.excluded};
      }));
      const q = {...question, images, confirmed: teacherReviewed && !question.excluded, versions: [] as NonNullable<Project['chemistry']>['questions'][number]['versions']};
      if (q.excluded) issues.push(`第 ${q.number} 题：待核实，已排除`);
      for (const notes of versions) {
        if (notes.result.status !== 'ok') issues.push(`第 ${q.number} 题 · ${notes.module}：待核实`);
        q.versions.push({...notes, id: uid(), createdAt: project.updatedAt, origin: 'ai', fingerprint: chemFingerprint(q), confirmed: teacherReviewed && !q.excluded && notes.result.status === 'ok'});
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
  for (const q of preview.questions) q.confirmed = !q.excluded && !!q.answer.trim() && !q.versions.some(v => v.conflict);
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
