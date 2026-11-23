import {z} from 'zod';
import {chineseModules} from '../../../src/core/chinese';
import {chineseLessonReason, latestAvailableChineseVersion, chineseLessonNames, type ChineseLessonModule} from '../../../src/core/chinese-lesson-selection';
import {chemModules} from '../../../src/core/chemistry';
import {resolveChemSelection, type ChemLessonModule} from '../../../src/core/chemistry-workflow';
import {GenerationContentError} from '../../../src/core/errors';
import {lessonAvailability, lessonModuleNames, lessonModules, type LessonModule, type LessonSelection} from '../../../src/core/lesson-deck';
import type {Project} from '../../../src/core/model';
import {applicableSpecial} from '../../../src/core/special';

const id = z.string().trim().min(1);
export const selectionEntrySchema = z.object({
  passageId: id.optional(), groupId: id.optional(), questionId: id.optional(),
  module: z.enum([...new Set([...lessonModules, ...chineseModules, ...chemModules])]),
});
type SelectionEntry = z.infer<typeof selectionEntrySchema>;

export function selectSkillContent(project: Project, entries: SelectionEntry[], reviewIssues: string[]): LessonSelection | string[] {
  const fail = (message: string): never => { throw new GenerationContentError(message); };
  const failQuestion = (number: string, message: string): never => {
    const issue = reviewIssues.find(item => item.startsWith(`第 ${number} 题：`));
    return fail(issue ? message + '。' + issue : message);
  };
  const entryKeys = entries.map(entry => JSON.stringify([entry.passageId, entry.groupId, entry.questionId, entry.module]));
  if (new Set(entryKeys).size !== entries.length) fail('交付范围含重复的篇目、题目或模块');
  if (project.subject === 'chemistry') {
    const data = project.chemistry!;
    return entries.map(({questionId, passageId, groupId, module}) => {
      const question = data.questions.find(q => q.id === questionId);
      if (!question || passageId || groupId || !(['source', ...chemModules] as string[]).includes(module))
        return fail('化学交付范围需要有效的 questionId 和模块。' + (questionId ?? '') + ' · ' + module);
      const result = resolveChemSelection(data, {questionIds: [question.id], modules: {[question.id]: [module as ChemLessonModule]}});
      if (result.issues.length) return failQuestion(question.number, result.issues.join('\n'));
      return result.ids[0];
    });
  }
  if (project.subject === 'chinese') {
    const data = project.chinese!;
    return entries.map(({groupId, passageId, questionId, module}) => {
      const group = data.groups.find(g => g.id === groupId);
      if (!group || passageId || !(['source', ...chineseModules] as string[]).includes(module))
        return fail('语文交付范围需要有效的 groupId 和模块。' + (groupId ?? '') + ' · ' + module);
      const question = group.questions.find(q => q.id === questionId);
      const perQuestion = module === 'analysis' || module === 'practice';
      if (perQuestion ? !question : questionId)
        return fail(group.title + ' · ' + module + '：所选题目与材料组或模块不匹配');
      const lessonModule = module as ChineseLessonModule;
      const reason = chineseLessonReason(data, group, lessonModule, question ? [question.id] : []);
      if (reason) {
        const message = `${group.title} · ${question ? '第 ' + question.number + ' 题 · ' : ''}${chineseLessonNames[lessonModule]}：${reason}`;
        return question ? failQuestion(question.number, message) : fail(message);
      }
      return lessonModule === 'source' ? 'source:' + group.id : latestAvailableChineseVersion(data, group, lessonModule, question?.id)!.id;
    });
  }

  const selection: LessonSelection = {passageIds: [], questionIds: [], modules: Object.create(null), questionIdsByModule: {analysis: [], practice: [], special: []}};
  for (const {passageId, groupId, questionId, module} of entries) {
    const passage = project.passages.find(p => p.id === passageId);
    if (!passage || groupId || !(lessonModules as readonly string[]).includes(module))
      return fail('英语交付范围需要有效的 passageId 和模块。' + (passageId ?? '') + ' · ' + module);
    const lessonModule = module as LessonModule;
    const question = project.questions.find(q => q.id === questionId && q.passageId === passage.id);
    const specialByQuestion = module === 'special' && !['writing', 'continuation'].includes(passage.type);
    const requiresQuestion = module === 'analysis' || module === 'practice' || specialByQuestion;
    const name = passage.title + ' · ' + lessonModuleNames[lessonModule];
    if (questionId && !requiresQuestion || requiresQuestion && !question)
      return fail(name + '：所选题目与篇目或模块不匹配');
    const reason = lessonAvailability(project, passage.id, lessonModule, question?.id);
    if (reason) {
      const message = name + (question ? ' · 第 ' + question.number + ' 题' : '') + '：' + reason;
      return question ? failQuestion(question.number, message) : fail(message);
    }
    if (specialByQuestion && question) {
      const kind = applicableSpecial(passage.type)[0];
      const version = passage.special?.versions.find(v => v.id === passage.special?.active[kind]);
      if (!question.confirmed || question.excluded || !version?.result.items.some(item => [item.question_id, item.blank_id].includes(question.id))) {
        return failQuestion(question.number, name + ' · 第 ' + question.number + ' 题：未生成所选题目的专项讲评');
      }
    }
    if (!selection.passageIds.includes(passage.id)) selection.passageIds.push(passage.id);
    const modules = selection.modules[passage.id] ??= [];
    if (!modules.includes(lessonModule)) modules.push(lessonModule);
    if (question && (module === 'analysis' || module === 'practice' || module === 'special')) {
      if (!selection.questionIds.includes(question.id)) selection.questionIds.push(question.id);
      selection.questionIdsByModule![module]!.push(question.id);
    }
  }
  return selection;
}
