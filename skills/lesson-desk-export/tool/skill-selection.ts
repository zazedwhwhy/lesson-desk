import {applicableChineseModules} from '../../../src/core/chinese';
import {chineseLessonReason, latestAvailableChineseVersion} from '../../../src/core/chinese-lesson-selection';
import {defaultChemSelection, resolveChemSelection} from '../../../src/core/chemistry-workflow';
import {lessonAvailability, lessonModules, type LessonSelection} from '../../../src/core/lesson-deck';
import type {Project} from '../../../src/core/model';
import {applicableSpecial} from '../../../src/core/special';

export function selectSkillContent(project: Project): LessonSelection | string[] {
  if (project.subject === 'chemistry') {
    const result = resolveChemSelection(project.chemistry!, defaultChemSelection(project.chemistry!));
    if (result.issues.length) throw Error(result.issues.join('；'));
    return result.ids;
  }
  if (project.subject === 'chinese') {
    const data = project.chinese!;
    return data.groups.flatMap(group => [
      ...(chineseLessonReason(data, group, 'source', []) === null ? ['source:' + group.id] : []),
      ...applicableChineseModules(group).flatMap(module => {
        const targets = module === 'analysis' || module === 'practice' ? group.questions.map(q => q.id) : [undefined];
        return targets.flatMap(id => {
          const version = latestAvailableChineseVersion(data, group, module, id);
          return version ? [version.id] : [];
        });
      }),
    ]);
  }

  const selection: LessonSelection = {passageIds: [], questionIds: [], modules: {}, questionIdsByModule: {analysis: [], practice: []}};
  for (const passage of project.passages) {
    const qs = project.questions.filter(q => q.passageId === passage.id && q.confirmed && !q.excluded);
    const analysis = qs.filter(q => lessonAvailability(project, passage.id, 'analysis', q.id) === null).map(q => q.id);
    const practice = qs.filter(q => lessonAvailability(project, passage.id, 'practice', q.id) === null).map(q => q.id);
    const kind = applicableSpecial(passage.type)[0];
    const special = passage.special?.versions.find(v => v.id === passage.special?.active[kind]);
    const specialQuestions = special?.result.items.map(item => item.question_id ?? item.blank_id) ?? [];
    const modules = lessonModules.filter(module => {
      if (module === 'analysis') return analysis.length > 0;
      if (module === 'practice') return practice.length > 0 || lessonAvailability(project, passage.id, 'practice') === null;
      if (lessonAvailability(project, passage.id, module) !== null) return false;
      return module !== 'special' || ['writing_task', 'continuation'].includes(kind) || qs.some(q => specialQuestions.includes(q.id));
    });
    if (!modules.length) continue;
    selection.passageIds.push(passage.id);
    selection.modules[passage.id] = modules;
    selection.questionIdsByModule!.analysis!.push(...analysis);
    selection.questionIdsByModule!.practice!.push(...practice);
    selection.questionIds.push(...qs.filter(q => analysis.includes(q.id) || practice.includes(q.id) || modules.includes('special') && specialQuestions.includes(q.id)).map(q => q.id));
  }
  return selection;
}
