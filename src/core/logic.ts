import {reconcileOcrReview} from './source-fidelity';
import {reviseChemistry} from './chemistry';
import { active, type Project, type Question, type Slide, type Passage } from './model';
import{exerciseText,exerciseAnswerText}from'./exercise';
export function questionExercise(p:Project,q:Question){const a=p.passages.find(a=>a.id===q.passageId),v=a?.learning?.versions.find(v=>v.id===a.learning?.activeVersion);if(!a?.learning?.stale&&v?.sourceText===teachingSource(p,q.passageId)){const exercise=v.data.transfer.find(t=>t.questionId===q.id)?.exercise;if(exercise)return exercise;}return !q.stale?active(q)?.exercise:undefined;}
export function issues(p: Project, q: Question): string[] { if (q.excluded)
    return []; const out: string[] = []; const a = p.passages.find(x => x.id === q.passageId); if (!a)
    out.push('缺少关联材料'); if (!q.stem.trim())
    out.push('缺少题干'); if (!q.answer.trim())
    out.push('缺少参考答案'); if (p.questions.some(x => x.id !== q.id && x.passageId === q.passageId && x.number === q.number && !x.excluded))
    out.push('同组题号重复'); if (q.type === 'listening' && !a?.paragraphs.some(b => b.text.trim()))
    out.push('缺少听力原文'); if (active(q)?.conflict)
    out.push('AI答案与参考答案冲突'); return out; }
const source=(a:Passage|undefined)=>a?[a.type,a.paragraphs,a.pool]:null;
export function reviseProject(old: Project, next: Project): Project { reconcileOcrReview(old.sources,next.sources); if(next.chemistry)reviseChemistry(old.chemistry,next.chemistry); for (const q of next.questions) {
    const prev = old.questions.find(x => x.id === q.id);
    if (!prev)
        continue;
    const changed = JSON.stringify([prev.stem, prev.answer, prev.options, prev.passageId, prev.type, source(old.passages.find(x => x.id === prev.passageId))]) !== JSON.stringify([q.stem, q.answer, q.options, q.passageId, q.type, source(next.passages.find(x => x.id === q.passageId))]);
    if (changed) {
        q.confirmed = false;
        q.stale = q.versions.length > 0;
    }
} for(const a of next.passages){const prev=old.passages.find(x=>x.id===a.id);if(a.learning&&(JSON.stringify(source(prev))!==JSON.stringify(source(a))||JSON.stringify(old.questions.filter(q=>q.passageId===a.id).map(q=>[q.id,q.stem,q.options,q.answer,q.excluded]))!==JSON.stringify(next.questions.filter(q=>q.passageId===a.id).map(q=>[q.id,q.stem,q.options,q.answer,q.excluded]))))a.learning.stale=true;} next.updatedAt = new Date().toISOString(); return next; }
export function validateBundlePath(s: string) { if (!s || s.includes('\\') || s.startsWith('/') || s.includes(':') || s.split('/').some(x => x === '..' || x === '.' || !x))
    throw Error('课件包包含非法路径'); }
function chunks(s: string, max = 330) { const out: string[] = []; let buffer = '', width = 0, lines = 1; for (const char of s) {
    const weight = /[\u0000-\u007f]/.test(char) ? .55 : 1;
    if (char === '\n') {
        lines++;
        width = 0;
    }
    else {
        width += weight;
        if (width > 33) {
            lines++;
            width = weight;
        }
    }
    if ((lines > 9 || buffer.length >= max) && buffer) {
        out.push(buffer);
        buffer = '';
        width = char === '\n' ? 0 : weight;
        lines = 1;
    }
    buffer += char;
} if (buffer)
    out.push(buffer); return out; }
export function buildDeck(p: Project, selected?: string[],includeTeaching=false): Slide[] { const slides: Slide[] = []; const add = (kind: string, title: string, text: string, qid?: string) => { const parts = chunks(text); parts.forEach((body, i) => slides.push({ id: `s${slides.length}`, kind, title: title + (parts.length > 1 ? `（${i + 1}/${parts.length}）` : ''), body: [body], questionId: qid })); }; for (const a of p.passages) {
    const qs = p.questions.filter(q => q.passageId === a.id && !q.excluded && (!selected || selected.includes(q.id)));
    if (!qs.length)
        continue;
    add('passage', a.title, a.paragraphs.map(b => b.text).join('\n\n') + (a.pool ? '\n选项池\n' + a.pool : ''));
    for (const q of qs) {
        add('question', `第 ${q.number} 题`, [q.stem, ...q.options].join('\n'), q.id);
        const e = active(q);
        if (e && !q.stale) {
            add('analysis', `第 ${q.number} 题 · 解析`, `参考答案：${q.answer}\n${e.analysis}\n${e.evidence.map(x => x.quote).join('\n')}`, q.id);
        }
        const exercise=questionExercise(p,q);if(exercise||e&&!q.stale&&e.practice.trim()){
            add('practice','考点演练 · AI生成',exercise?exerciseText(exercise):e!.practice,q.id);
            add('practice-answer','考点演练参考答案 · AI生成',exercise?exerciseAnswerText(exercise):e!.practiceAnswer,q.id);
        }
    }
if(includeTeaching&&a.learning&&!a.learning.stale){const d=a.learning.versions.find(v=>v.id===a.learning!.activeVersion)?.data;if(d){for(const s of d.sentences)add('teaching','长难句 · '+a.title,[s.quote,s.translation,'主干：'+s.trunk,...(s.parts||[]).map(part=>part.role+'：'+part.text+'（'+part.explanation+'）'),s.clauses,'考点：'+s.examTip].join('\n'));if(!a.learning.versions.find(v=>v.id===a.learning!.activeVersion)?.completedModules||a.learning.versions.find(v=>v.id===a.learning!.activeVersion)!.completedModules!.includes('structure'))add('teaching','文章结构 · '+a.title,[d.structure.genre,d.structure.theme,...d.structure.outline.map(o=>'第'+o.paragraph+(o.endParagraph&&o.endParagraph!==o.paragraph?'–'+o.endParagraph:'')+'段：'+o.role+' '+o.summary+(o.relation?'\n衔接：'+o.relation:'')+(o.evidence?'\n原文依据：'+o.evidence.map(e=>e.quote).join(' / '):'')),d.structure.logic,d.structure.examFocus,...(d.structure.questionLinks||[]).map(q=>'第'+q.questionNumber+'题 · '+q.focus+'：'+q.method+'\n定位依据：'+q.evidence.map(e=>e.quote).join(' / '))].join('\n'));for(const w of d.lexicon)add('teaching','词句记忆 · '+w.term,[w.partOfSpeech||'',w.meaning,w.sourceForm?'原文形态：'+w.sourceForm:'',w.sourceQuote,w.usageNote?'本句用法：'+w.usageNote:'',w.collocations,w.contrast,w.memory,w.memoryExample?'用法例句：'+w.memoryExample:'',w.exampleTranslation?'例句译文：'+w.exampleTranslation:'','原文回忆：'+w.quiz,'参考答案：'+w.answer].join('\n'));for(const q of d.transfer){if(q.questionId&&qs.some(x=>x.id===q.questionId))continue;add('teaching','考点演练 · AI新编',[q.type,q.stem,...q.options].join('\n'));add('teaching','考点演练参考答案',[q.answer,q.analysis,q.point].join('\n'));}for(const s of d.imitation){add('teaching','好句仿写',[s.quote,s.pattern,s.why,'任务：'+s.task].join('\n'));add('teaching','仿写参考 · AI新编',[s.example,s.reference,...s.checklist].join('\n'));}}}
} return slides; }

export function teachingSource(p:Project,pid:string){const a=p.passages.find(a=>a.id===pid);return JSON.stringify([a?.type,a?.pool,a?.paragraphs,p.questions.filter(q=>q.passageId===pid).map(q=>[q.id,q.number,q.type,q.stem,q.options,q.answer,q.excluded])]);}
