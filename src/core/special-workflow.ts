import {GenerationContentError} from './errors';
import {optionEntries} from './options';
import {applicableSpecial, specialKinds, specialInputSchema, specialResultSchema, specialSchemas, type SpecialKind} from './special';
import type {Project} from './model';

const questionKinds = ['option_evidence', 'cohesion', 'cloze_chain'];

export function prepareSpecial(project: Project, passageId: string, kind: SpecialKind, raw: unknown) {
  const input = specialInputSchema.parse(raw);
  if (!specialKinds.includes(kind)) throw Error('未知专项功能');
  const passage = project.passages.find(p => p.id === passageId);
  if (!passage) throw Error('找不到当前文章');
  if (!applicableSpecial(passage.type).includes(kind)) throw Error('此功能与当前题型不匹配，请在整理材料中核对题型');
  const questions = project.questions.filter(q => q.passageId === passageId && !q.excluded && input.questionIds.includes(q.id));
  if (questionKinds.includes(kind) && !questions.length) throw Error('请选择至少一道本篇题目');
  if (['option_evidence', 'cloze_chain'].includes(kind) && questions.some(q => !q.options.length)) throw Error('所选题目缺少选项，请先整理材料');
  if (kind === 'cohesion' && !passage.pool.trim() && !questions.some(q => q.options.length)) throw Error('缺少七选五候选选项池，请先补充');
  if (questions.some(q => !q.confirmed)) throw Error('请先在整理材料中核对并确认所选题目');
  if (!passage.paragraphs.some(b => b.text.trim()) && !questions.some(q => q.stem.trim())) throw Error('本篇缺少可读取材料');
  if (kind === 'continuation' && (!input.opening1.trim() || !input.opening2.trim())) throw Error('请补充两段给定的段首句，不能由模型猜测');
  const paragraphs = passage.paragraphs.map((b, i) => ({location: 'P' + (i + 1), text: b.text}));
  const context = {
    function: kind, material_complete: input.material_complete, sources: [{source_id: passage.id, paragraphs}],
    questions: questions.map(q => ({
      question_id: q.id, question_number: q.number, stem: q.stem, options: optionEntries(q.options), reference_answer: q.answer,
    })),
    option_pool: passage.pool, additional_requirements: input.extra,
    paragraph_openings: kind === 'continuation' ? [input.opening1, input.opening2] : [],
  };
  return {input, context, questions, passage};
}

export function validateSpecialResult(prepared: ReturnType<typeof prepareSpecial>, raw: unknown) {
  const {input, context, questions, passage} = prepared;
  const kind = context.function, paragraphs = context.sources[0].paragraphs;
  const result = specialResultSchema.parse(specialSchemas[kind].parse(raw));
  const original = paragraphs.map(block => block.text).join('\n');
  const allText = [original, ...questions.map(q => q.stem), input.extra, input.opening1, input.opening2].join('\n');
  const warn = (message: string) => {
    if (result.status === 'ok') result.status = 'needs_review';
    if (!result.notices.includes(message)) result.notices.push(message);
  };

  function check(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(check);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const item = node as Record<string, unknown>;
    if (typeof item.quote === 'string') {
      let sourceText: string;
      if (item.source_id === passage.id) {
        const block = paragraphs.find(b => b.location === item.location);
        if (item.location && !block) throw new GenerationContentError('AI引用了不存在的段落编号，结果未保存');
        sourceText = block?.text ?? original;
      } else {
        const question = questions.find(q => q.id === item.source_id);
        if (!question) throw new GenerationContentError('AI引用了不存在的材料ID，结果未保存');
        sourceText = question.stem;
      }
      if (!item.quote.trim() || !sourceText.includes(item.quote)) throw new GenerationContentError('AI引用未在对应原文找到，结果未保存，请重试');
    }
    if (kind === 'writing_task' && typeof item.evidence === 'string' && (!item.evidence.trim() || !allText.includes(item.evidence)))
      throw new GenerationContentError('审题单的要求没有对应原题证据，结果未保存');
    if (item.verdict === 'supported' && Array.isArray(item.evidence) && !item.evidence.length) warn('部分判断缺少原文引证，请教师核实');
    if (item.verdict === 'uncertain') warn('部分选项依据不足，请教师核实');
    Object.values(item).forEach(check);
  }

  check(result.items);
  if (kind === 'cloze_chain' && result.items.some(item => typeof item.local_sentence === 'string' && item.local_sentence && !allText.includes(item.local_sentence)))
    throw new GenerationContentError('空位原句不匹配，结果未保存');
  if (!result.items.length && result.status === 'ok') throw new GenerationContentError('AI未返回分析内容，结果未保存');

  if (questionKinds.includes(kind)) {
    const seen = new Set<string>();
    for (const item of result.items) {
      const id = String(item.question_id ?? item.blank_id);
      const question = questions.find(q => q.id === id);
      if (!question || seen.has(id)) throw new GenerationContentError('AI返回题号不匹配或重复，结果未保存');
      seen.add(id);
      if (kind === 'option_evidence' && item.question_number !== question.number) throw new GenerationContentError('模型改动了题号，结果未保存');
      if (item.reference_answer !== question.answer) throw new GenerationContentError('AI改动了参考答案，结果未保存');
      if (!question.answer.trim()) warn('部分题目缺少参考答案，不应视为已确认解析');
      if (kind !== 'cohesion') {
        const labels = (item.options as {label: string}[]).map(o => o.label);
        const expected = context.questions.find(q => q.question_id === id)!.options.map(o => o.label);
        if (labels.length !== expected.length || new Set(labels).size !== expected.length || labels.some(label => !expected.includes(label)))
          throw new GenerationContentError('AI未完整对应题目选项，结果未保存');
      }
    }
    if (seen.size !== questions.length) warn('部分所选题目未生成，请核实材料后重试');
  }
  if (kind === 'continuation') for (const item of result.items) {
    const openings = item.paragraph_openings as {paragraph_number: number; given_sentence: string}[];
    if (openings.length !== 2 || openings.some((opening, index) =>
      opening.paragraph_number !== index + 1 || opening.given_sentence !== context.paragraph_openings[index]))
      throw new GenerationContentError('模型未准确保留给定段首句，结果未保存');
  }
  return result;
}
