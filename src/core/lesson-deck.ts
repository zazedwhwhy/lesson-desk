import {paginateBlocks,defaultSlideLayout,type SlideLayout} from './slide-layout';
import { active, type Project, type Question } from './model';
import { questionExercise, teachingSource } from './logic';
import { exerciseAnswerText, exerciseText } from './exercise';
import { applicableSpecial, specialFingerprint, specialNames, type SpecialKind } from './special';

export const lessonModules = ['source', 'translation', 'analysis', 'practice', 'sentences', 'structure', 'lexicon', 'imitation', 'special'] as const;
export type LessonModule = typeof lessonModules[number];
export const lessonModuleNames: Record<LessonModule, string> = {
  source: '英文原文', translation: '中文译文', analysis: '逐题讲评', practice: '考点演练',
  sentences: '句法拆解', structure: '篇章脉络', lexicon: '词汇手账', imitation: '表达迁移', special: '专项讲评'
};
export type LessonSelection = { passageIds: string[]; questionIds: string[]; modules: Record<string, LessonModule[]> };
export type LessonBlock = { label: string; text: string; emphasis?: boolean };
export type LessonSlide = { id: string; kind: LessonModule | 'question' | 'practice-answer' | 'imitation-answer'; title: string; section: string; blocks: LessonBlock[]; body: string[]; questionId?: string; passageId: string };

function versionFor(p: Project, passageId: string) {
  const passage = p.passages.find(a => a.id === passageId);
  const learning = passage?.learning;
  const version = learning?.versions.find(v => v.id === learning.activeVersion);
  return !learning?.stale && version?.sourceText === teachingSource(p, passageId) ? version : undefined;
}
export function lessonAvailability(p: Project, passageId: string, module: LessonModule, questionId?: string): string | null {
  const a = p.passages.find(a => a.id === passageId);
  if (!a) return '缺少关联篇目';
  const q = questionId ? p.questions.find(q => q.id === questionId && q.passageId === passageId && !q.excluded) : undefined;
  if (questionId && !q) return '题目不存在或已排除';
  if (module === 'source') return a.paragraphs.some(b => b.text.trim()) ? null : '原文为空';
  if (module === 'translation') return a.translation.trim() && (a.translationSource === teachingSource(p, passageId) || p.example && !a.translationSource) ? null : '译文未生成或已过期';
  if (module === 'analysis') {
    if (!q) return '请选择题目';
    const e = active(q);
    return q.confirmed && !q.stale && e?.analysis.trim() && !e.conflict ? null : '解析未完成、已过期或答案待核实';
  }
  if (module === 'practice') {
    if (!q) return versionFor(p, passageId)?.data.transfer.some(t => !t.questionId) ? null : '请选择有练习的题目';
    return q.confirmed && !q.stale && questionExercise(p, q) ? null : '练习未生成或已过期';
  }
  if (module === 'special') {
    const kind = applicableSpecial(a.type)[0];
    if (!kind) return '此题型没有专项讲评';
    const v = a.special?.versions.find(v => v.id === a.special?.active[kind]);
    return v?.sourceText === specialFingerprint(p, passageId) && v.result.status === 'ok' && v.result.items.length ? null : '专项讲评未完成、需核实或已过期';
  }
  const version = versionFor(p, passageId);
  if (!version || version.completedModules && !version.completedModules.includes(module)) return '模块未生成或已过期';
  const data = version.data;
  if (module === 'structure') return data.structure.theme.trim() && data.structure.outline.length ? null : '篇章脉络未生成';
  return data[module].length ? null : '模块没有可用内容';
}
export function defaultLessonSelection(p: Project): LessonSelection {
  const questionIds = p.questions.filter(q => !q.excluded && lessonAvailability(p, q.passageId, 'analysis', q.id) === null).map(q => q.id);
  const passageIds = p.passages.filter(a => p.questions.some(q => questionIds.includes(q.id) && q.passageId === a.id)).map(a => a.id);
  const modules = Object.fromEntries(passageIds.map(pid => {
    const qs = p.questions.filter(q => questionIds.includes(q.id) && q.passageId === pid);
    return [pid, lessonModules.filter(m => m === 'analysis' || m === 'practice'
      ? (qs.length > 0 && qs.every(q => lessonAvailability(p, pid, m, q.id) === null)) || (m === 'practice' && !qs.length && lessonAvailability(p, pid, m) === null)
      : lessonAvailability(p, pid, m) === null)];
  })) as Record<string, LessonModule[]>;
  return { passageIds, questionIds, modules };
}
export function legacyLessonSelection(p: Project, ids: string[], includeTeaching = false): LessonSelection {
  const questionIds = p.questions.filter(q => ids.includes(q.id) && !q.excluded).map(q => q.id);
  const passageIds = p.passages.filter(a => p.questions.some(q => questionIds.includes(q.id) && q.passageId === a.id)).map(a => a.id);
  const allowed = includeTeaching ? lessonModules : lessonModules.filter(m => ['source', 'analysis', 'practice'].includes(m));
  const modules = Object.fromEntries(passageIds.map(pid => {
    const qs = p.questions.filter(q => questionIds.includes(q.id) && q.passageId === pid);
    return [pid, allowed.filter(m => m === 'analysis' || m === 'practice'
      ? qs.every(q => lessonAvailability(p, pid, m, q.id) === null)
      : lessonAvailability(p, pid, m) === null)];
  })) as Record<string, LessonModule[]>;
  return { passageIds, questionIds, modules };
}
export function lessonSelectionIssues(p: Project, selection: LessonSelection): string[] {
  const issues: string[] = [];
  if (!selection.passageIds.length) issues.push('请至少选择一篇材料');
  if (!selection.passageIds.some(pid => selection.modules[pid]?.length)) issues.push('请至少选择一种内容');
  for (const pid of selection.passageIds) {
    const a = p.passages.find(a => a.id === pid);
    if (!a) { issues.push('所选篇目已不存在'); continue; }
    const qs = p.questions.filter(q => selection.questionIds.includes(q.id) && q.passageId === pid && !q.excluded);
    for (const m of selection.modules[pid] || []) {
      if (m === 'analysis' || m === 'practice') {
        for (const q of qs) { const reason = lessonAvailability(p, pid, m, q.id); if (reason) issues.push(`${a.title} · 第${q.number}题 · ${lessonModuleNames[m]}：${reason}`); }
        if (!qs.length && m === 'practice') { const reason = lessonAvailability(p, pid, m); if (reason) issues.push(`${a.title} · 考点演练：${reason}`); }
      } else {
        const reason = lessonAvailability(p, pid, m);
        if (reason) issues.push(`${a.title} · ${lessonModuleNames[m]}：${reason}`);
        if (!reason && m === 'special' && ['reading', 'listening', 'seven', 'cloze'].includes(a.type)) {
          const kind = applicableSpecial(a.type)[0];
          const version = a.special?.versions.find(v => v.id === a.special?.active[kind]);
          if (!version?.result.items.some(item => qs.some(q => q.id === item.question_id || q.id === item.blank_id))) issues.push(`${a.title} · 专项讲评：所选题目没有对应内容`);
        }
      }
    }
  }
  return issues;
}

const clean = (value: unknown) => String(value ?? '').trim();
function block(label: string, value: unknown, emphasis = false): LessonBlock | undefined {
  const text = clean(value); return text ? { label, text, emphasis } : undefined;
}
function blocks(...values: (LessonBlock | undefined)[]): LessonBlock[] { return values.filter((v): v is LessonBlock => !!v); }
const specialLabels: Record<string, string> = { reference_answer: '参考答案', key_reason: '关键对应', question_type: '题型', teacher_question: '课堂追问', clue_explanation: '衔接线索', fit_before: '与前文衔接', fit_after: '与后文衔接', required_meaning: '语境含义', conclusion: '判断依据', task_summary: '写作任务', transition_requirement: '两段接续', reasoning: '判断理由', error_pattern: '易错点', quote: '原文依据', evidence: '依据', before_evidence: '空前依据', after_evidence: '空后依据', local_sentence: '空格所在句', explicit_requirements: '明确要求', unspecified: '未明确事项', outline_suggestion: '段落建议', expression_directions: '表达建议', checklist: '自查要点', known_facts: '已知事实', paragraph_openings: '段首句', possible_paths: '可选路径', consistency_checks: '连贯性自查', options: '选项分析', clues: '线索', comparison: '干扰项比较', given_sentence: '给定段首句', fixed_information: '固定信息', open_space: '可展开空间', context_meaning: '语境词义', reason: '原因', compatibility_reason: '契合原文', why_plausible: '看似合理', why_not_fit: '不符之处', verdict: '判定' };
const metadata = new Set(['question_id','question_number','question_type','blank_id','source_id','location','status','label','paragraph_number']);
function specialContent(value: unknown, label = ''): LessonBlock[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap((item, i) => specialContent(item, label + (value.length > 1 ? ` ${i + 1}` : '')));
  if (typeof value !== 'object') return blocks(block(label, value));
  const record = value as Record<string, unknown>;
  const heading = clean(record.label || record.question_number && `第${record.question_number}题` || record.blank_id && '空位讲评');
  return Object.entries(record).flatMap(([key, val]) => metadata.has(key) ? [] : specialContent(val, [label, heading, specialLabels[key] || key].filter(Boolean).join(' · ')));
}

export function buildLessonDeck(p: Project, selection: LessonSelection, layout:SlideLayout=defaultSlideLayout): LessonSlide[] {
  const errors = lessonSelectionIssues(p, selection);
  if (errors.length) throw Error(errors.join('\n'));
  const slides: LessonSlide[] = [];
  const add = (kind: LessonSlide['kind'], title: string, section: string, content: LessonBlock[], pid: string, qid?: string) => {
    paginateBlocks(content,layout,kind).forEach((page, i, all) => slides.push({ id: `slide-${slides.length}`, kind, title: title + (all.length > 1 ? `（${i + 1}/${all.length}）` : ''), section, blocks: page, body: page.map(b => b.text), questionId: qid, passageId: pid }));
  };
  for (const a of p.passages.filter(a => selection.passageIds.includes(a.id))) {
    const qs = p.questions.filter(q => q.passageId === a.id && !q.excluded && selection.questionIds.includes(q.id));
    const chosen = selection.modules[a.id] || [];
    if (chosen.includes('source')) add('source', a.title, '英文原文', blocks(block('', a.paragraphs.map(b => b.text).join('\n\n')), block('共用选项池', a.pool)), a.id);
    if (chosen.includes('translation')) add('translation', a.title, '中文译文', blocks(block('', a.translation)), a.id);
    for (const q of qs) {
      if (chosen.includes('analysis') || chosen.includes('practice')) add('question', `第 ${q.number} 题`, a.title, blocks(block('', q.stem), ...q.options.map((o, i) => block(`选项 ${i + 1}`, o))), a.id, q.id);
      if (chosen.includes('analysis')) {
        const e = active(q)!;
        add('analysis', `第 ${q.number} 题 · 逐题讲评`, a.title, blocks(block('参考答案', q.answer, true), block('AI 解析', e.analysis), ...e.evidence.map((x, i) => block(`原文依据 ${i + 1}`, x.quote))), a.id, q.id);
      }
      if (chosen.includes('practice')) {
        const exercise = questionExercise(p, q)!;
        add('practice', `第 ${q.number} 题 · 考点演练`, a.title, blocks(block('AI 新编练习', exerciseText(exercise))), a.id, q.id);
        add('practice-answer', `第 ${q.number} 题 · 演练讲评`, a.title, blocks(block('参考答案与解析', exerciseAnswerText(exercise))), a.id, q.id);
      }
    }
    const v = versionFor(p, a.id), d = v?.data;
    if (d && chosen.includes('practice')) d.transfer.filter(t => !t.questionId && !qs.some(q => {
      const existing = questionExercise(p, q);
      return existing && t.exercise && existing.material === t.exercise.material && existing.stem === t.exercise.stem;
    })).forEach((t, i) => {
      add('practice', `考点演练 · 补充练习 ${i + 1}`, a.title, blocks(block('AI 新编练习', t.exercise ? exerciseText(t.exercise) : [t.stem, ...t.options].join('\n'))), a.id);
      add('practice-answer', `考点演练 · 补充讲评 ${i + 1}`, a.title, blocks(block('参考答案与解析', t.exercise ? exerciseAnswerText(t.exercise) : [t.answer, t.analysis, t.point].join('\n'))), a.id);
    });
    if (d && chosen.includes('sentences')) d.sentences.forEach((s, i) => add('sentences', `句法拆解 · 句子 ${i + 1}`, a.title, blocks(block('原句', s.quote), block('句意', s.translation), block('句子主干', s.trunk), ...s.parts?.map(x => block(x.role, `${x.text}\n${x.explanation}`)) || [], block('结构讲解', s.clauses), block('应试提醒', s.examTip)), a.id));
    if (d && chosen.includes('structure')) add('structure', '篇章脉络', a.title, blocks(block('文体', d.structure.genre), block('文章主旨', d.structure.theme), ...d.structure.outline.flatMap(o => blocks(block(`第 ${o.paragraph}${o.endParagraph && o.endParagraph !== o.paragraph ? '–' + o.endParagraph : ''} 段 · ${o.role}`, o.summary), block('衔接', o.relation), ...o.evidence?.map(e => block('原文依据', e.quote)) || [])), block('行文逻辑', d.structure.logic), block('考点落点', d.structure.examFocus), ...d.structure.questionLinks?.filter(q => qs.some(selected => selected.id === q.questionId)).flatMap(q => blocks(block(`第 ${q.questionNumber} 题 · ${q.focus}`, q.method), ...q.evidence.map(e => block('定位依据', e.quote)))) || []), a.id);
    if (d && chosen.includes('lexicon')) d.lexicon.forEach(w => add('lexicon', `词汇手账 · ${w.term}`, a.title, blocks(block('本篇义', [w.partOfSpeech, w.meaning].filter(Boolean).join(' · ')), block('原文语境', w.sourceQuote), block('原文形态', w.sourceForm), block('本句用法', w.usageNote), block('常见搭配', w.collocations), block('易混辨析', w.contrast), block('记忆提示', w.memory), block('用法例句', w.memoryExample), block('例句译文', w.exampleTranslation), block('原文回忆', w.quiz), block('回忆答案', w.answer)), a.id));
    if (d && chosen.includes('imitation')) d.imitation.forEach((s, i) => {
      add('imitation', `表达迁移 · 句子 ${i + 1}`, a.title, blocks(block('原句', s.quote), block('句式骨架', s.pattern), block('适用方法', s.why), block('AI 扩展示例', s.example), block('仿写任务', s.task)), a.id);
      add('imitation-answer', `表达迁移 · 参考仿写 ${i + 1}`, a.title, blocks(block('AI 参考仿写', s.reference), block('自查要点', s.checklist.join('\n'))), a.id);
    });
    if (chosen.includes('special')) {
      const kind = applicableSpecial(a.type)[0] as SpecialKind;
      const result = a.special!.versions.find(v => v.id === a.special!.active[kind])!.result;
      result.items.filter(item => !['reading', 'listening', 'seven', 'cloze'].includes(a.type) || qs.some(q => q.id === item.question_id || q.id === item.blank_id)).forEach((item, i) => add('special', `${specialNames[kind]} · ${i + 1}`, a.title, specialContent(item), a.id));
    }
  }
  if (!slides.length) throw Error('所选范围没有可放映的内容，请选择题目或篇目内容');
  return slides;
}
