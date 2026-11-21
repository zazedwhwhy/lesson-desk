import {applyCorrections} from '../../../src/core/correction';
import {chemistryReviewSnapshot} from '../../../src/core/chemistry-review';
import {projectSchema, uid, type Project} from '../../../src/core/model';
import {proofreadFingerprint, validateProofreadResult} from '../../../src/core/proofread';
import type {SkillManifest} from './lesson-project';

const externalModel = {provider: 'Agent Skill', model: '外部 AI 客户端'};

function reviewCoverage(
  review: {coverage: 'complete' | 'partial'; checkedQuestionIds: string[]; limitations: string[]}, ids: string[],
) {
  const checked = new Set(review.checkedQuestionIds);
  if (checked.size !== review.checkedQuestionIds.length || review.checkedQuestionIds.some(id => !ids.includes(id)))
    throw Error('校对报告的题目编号不存在或重复');
  if (review.coverage === 'complete' && ids.some(id => !checked.has(id))) throw Error('校对遗漏题目，不能标记全部检查');
  if (review.coverage === 'partial' && !review.limitations.length) throw Error('校对报告缺少未覆盖范围');
}

export function attachSkillWorkflow(project: Project, input: SkillManifest['project'], issues: string[], bundleOnly: boolean) {
  let next = projectSchema.parse(project);
  if (input.subject === 'english') {
    if (input.review) {
      const {includeExplanations, result} = input.review;
      next.proofread = {
        id: uid(), createdAt: next.updatedAt, ...externalModel, includeExplanations,
        inputSnapshot: proofreadFingerprint(next, includeExplanations), result: validateProofreadResult(next, result),
      };
    }
    if (input.correction) {
      if (!bundleOnly) throw Error('自动修正先生成待核对课件包，请使用 --bundle-only');
      if (next.sources.some(source => source.ocrReviewPages?.length)) throw Error('请先核对扫描识别结果，再应用自动修正');
      const plan = structuredClone(input.correction.plan);
      for (const operation of plan.operations) {
        if (operation.kind !== 'explanation' || operation.beforeVersion !== 'manifest') continue;
        const current = next.questions.find(q => q.id === operation.questionId)?.activeVersion;
        if (!current) throw Error('清单缺少要修正的逐题解析');
        operation.beforeVersion = current;
      }
      next = applyCorrections(next, plan, externalModel, input.correction.includeExplanations);
      const record = next.corrections!.at(-1)!;
      issues.push(...record.changes.map(change => `${change.target} · ${change.reason}`), ...record.unresolved);
      if (record.changes.length) issues.push('修正后请重新校对；本次保留可撤销的修正记录。');
    }
  } else if (input.subject === 'chinese' && input.review) {
    const data = next.chinese!, review = input.review;
    reviewCoverage(review, data.groups.flatMap(group => group.questions.map(q => q.id)));
    for (const item of review.findings)
      if (!data.groups.some(group => group.id === item.groupId && (!item.questionId || group.questions.some(q => q.id === item.questionId))))
        throw Error('语文校对问题关联无效');
    data.review = {snapshot: JSON.stringify([next.sources, data.groups.map(({versions, ...group}) => group)]), result: review};
  } else if (input.subject === 'chemistry' && input.review) {
    const data = next.chemistry!, review = input.review;
    const ids = data.questions.map(q => q.id);
    reviewCoverage(review, ids);
    if (review.findings.some(item => !ids.includes(item.questionId))) throw Error('化学校对问题关联无效');
    data.review = {snapshot: chemistryReviewSnapshot(next), result: review};
  }
  const report = next.proofread?.result ?? next.chinese?.review?.result ?? next.chemistry?.review?.result;
  if (report) {
    issues.push(...report.limitations);
    for (const item of report.findings) {
      if ('description' in item) {
        const numbers = next.questions.filter(q => item.questionIds.includes(q.id)).map(q => q.number);
        const location = numbers.length ? `第 ${numbers.join('、')} 题` : '材料';
        issues.push(`${location} · ${item.description} · ${item.suggestion}`);
      } else {
        const group = 'groupId' in item ? next.chinese?.groups.find(g => g.id === item.groupId) : undefined;
        const question = group?.questions.find(q => q.id === item.questionId) ?? next.chemistry?.questions.find(q => q.id === item.questionId);
        const location = [group?.title, question && `第 ${question.number} 题`].filter(Boolean).join(' · ');
        issues.push(`${location} · ${item.message}`);
      }
    }
  }
  return projectSchema.parse(next);
}
