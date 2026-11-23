import {z} from 'zod';
import {EvidenceValidationError, resolveEvidence} from '../../../src/core/evidence';
import type {Project} from '../../../src/core/model';
import {sourceAnswerKeys} from '../../../src/core/proofread';

const text = z.string().trim().min(1);
export const answerFields = {
  answerEvidence: z.object({sourceId: text, blockId: text, quote: text}).optional(),
  answerOrigin: z.literal('teacher').optional(),
  trialAnswer: text.optional(),
};
type AnswerInput = z.infer<z.ZodObject<typeof answerFields>> & {number: string; answer: string};
const canonical = (value: string) => value.replace(/[！-～]/gu, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
  .replace(/\s+/gu, ' ').trim();

export function checkSkillAnswer(project: Project, question: AnswerInput, teacherReviewed: boolean) {
  const {number, answer, answerEvidence, answerOrigin, trialAnswer} = question;
  const fail = (reason: string): never => { throw new EvidenceValidationError('第 ' + number + ' 题：' + reason); };

  if (trialAnswer) {
    if (answer.trim() || answerEvidence || answerOrigin) fail('待核对试解请单独填写，不能同时写入参考答案或答案来源');
    return;
  }
  if (answerOrigin === 'teacher') {
    if (!teacherReviewed || !answer.trim() || answerEvidence) fail('教师确认答案需要实际确认、填写答案并使用 --teacher-reviewed');
    return;
  }
  if (!answer.trim() && !answerEvidence) return;
  if (!answerEvidence) return fail('参考答案缺少答案来源，请提供 answerEvidence 或使用已确认的教师答案');
  const source = project.sources.find(item => item.id === answerEvidence.sourceId && item.role === 'answer');
  const block = source?.blocks.find(item => item.id === answerEvidence.blockId);
  if (!source || !block) return fail('找不到所指定的答案来源或原文块');
  let quote: string;
  try {
    quote = resolveEvidence([block], answerEvidence).quote;
  } catch (error) {
    if (!(error instanceof EvidenceValidationError)) throw error;
    return fail('答案来源引用无效。' + error.message);
  }
  const lines = (value: string) => '\n' + value.split(/\r?\n/u).map(line => line.trim()).join('\n') + '\n';
  if (!lines(block.text).includes(lines(quote))) return fail('请引用带题号的完整答案行');

  const escaped = canonical(number).replace(/[.*+?^$()[\]{}|\\]/gu, '\\$&');
  const single = new RegExp('^(?:第\\s*' + escaped + '\\s*题[.、:]*|\\(\\s*' + escaped + '\\s*\\)[.、:]*|' +
    escaped + '(?:\\s*[.、:)]|(?=\\s)))\\s*(?:答案\\s*[:.]\\s*)?(.+)$', 'u');
  const indexed = sourceAnswerKeys({...project, sources: [{...source, blocks: [{...block, text: canonical(quote)}]}]})
    .find(item => item.number === canonical(number));
  const original = indexed?.answer ?? canonical(quote).match(single)?.[1];
  if (!original) return fail('答案来源无法关联到该题，请引用包含对应题号的完整答案行或答案表');
  const normalizeAnswer = (value: string) => /^[A-G]{1,7}$/iu.test(value) ? value.toUpperCase() : value;
  if (normalizeAnswer(canonical(answer)) !== normalizeAnswer(canonical(original))) {
    fail('参考答案「' + answer + '」与所绑定答案原文「' + original + '」不一致');
  }
}
