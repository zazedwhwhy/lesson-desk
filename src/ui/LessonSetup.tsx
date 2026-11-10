import {PptTemplatePicker} from './PptTemplatePicker';
import type {PptTemplate} from '../core/ppt-templates';
import React from 'react';
import { Download, Play } from 'lucide-react';
import type { Project } from '../core/model';
import { buildLessonDeck, lessonAvailability, lessonModuleNames, lessonModules, lessonSelectionIssues, type LessonModule, type LessonSelection } from '../core/lesson-deck';

type Props = { template:PptTemplate;onTemplate:(value:PptTemplate)=>void;onTemplatePending:(pending:boolean)=>void; project: Project; selection: LessonSelection; onChange: (next: LessonSelection) => void; onPresent: () => void; onExport: () => void; onBack: () => void; busy: boolean };
export function LessonSetup({ project: p, selection, onChange, onPresent, onExport, onBack, busy,template,onTemplate,onTemplatePending }: Props) {
  const issues = lessonSelectionIssues(p, selection);
  let pages = 0;
  if (!issues.length) { try { pages = buildLessonDeck(p, selection,template.layout).length; } catch { /* The exact reason appears in the checklist below. */ } }
  const togglePassage = (pid: string, checked: boolean) => {
    const ids = p.questions.filter(q => q.passageId === pid && !q.excluded && lessonAvailability(p, pid, 'analysis', q.id) === null).map(q => q.id);
    const modules = lessonModules.filter(m => m === 'analysis' || m === 'practice'
      ? (ids.length > 0 && ids.every(qid => lessonAvailability(p, pid, m, qid) === null)) || (m === 'practice' && !ids.length && lessonAvailability(p, pid, m) === null)
      : lessonAvailability(p, pid, m) === null);
    onChange({ passageIds: checked ? [...selection.passageIds, pid] : selection.passageIds.filter(id => id !== pid),
      questionIds: checked ? [...new Set([...selection.questionIds, ...ids])] : selection.questionIds.filter(id => !p.questions.some(q => q.id === id && q.passageId === pid)),
      modules: { ...selection.modules, [pid]: checked ? modules : [] } });
  };
  const toggleQuestion = (qid: string, checked: boolean) => onChange({ ...selection, questionIds: checked ? [...selection.questionIds, qid] : selection.questionIds.filter(id => id !== qid) });
  const toggleModule = (pid: string, module: LessonModule, checked: boolean) => onChange({ ...selection, modules: { ...selection.modules, [pid]: checked ? [...new Set([...(selection.modules[pid] || []), module])] : (selection.modules[pid] || []).filter(m => m !== module) } });
  return <main className="lesson-setup" data-screen-label="授课内容选择">
    <header className="lesson-setup-heading"><div><h1>编排本次讲课</h1><p>按篇选择题目和已完成的讲义。放映与可编辑 PPT 使用同一套页面。</p></div><div className="lesson-page-count"><strong>{pages || '—'}</strong><span>预计页面</span></div></header>
    <PptTemplatePicker value={template} onChange={onTemplate} onPending={onTemplatePending} busy={busy}/>
    <div className="lesson-setup-layout"><div className="lesson-groups">
      {p.passages.map(a => { const chosen = selection.passageIds.includes(a.id), questions = p.questions.filter(q => q.passageId === a.id && !q.excluded), selectedQuestions = questions.filter(q => selection.questionIds.includes(q.id)); return <section className={'lesson-group' + (chosen ? ' is-selected' : '')} key={a.id}>
        <label className="lesson-passage"><input type="checkbox" checked={chosen} disabled={busy} onChange={e => togglePassage(a.id, e.target.checked)}/><span><strong>{a.title}</strong><small>{questions.length} 道题 · {selectedQuestions.length} 道已选</small></span></label>
        {chosen && <div className="lesson-group-body"><fieldset><legend>题目</legend><div className="lesson-choice-grid">{questions.length ? questions.map(q => { const reason = lessonAvailability(p, a.id, 'analysis', q.id); return <label key={q.id} className="lesson-choice"><input type="checkbox" checked={selection.questionIds.includes(q.id)} disabled={busy} onChange={e => toggleQuestion(q.id, e.target.checked)}/><span>第 {q.number} 题<small>{reason || '讲评已完成'}</small></span></label>; }) : <p className="lesson-hint">本篇暂无题目，可选择原文和篇章内容。</p>}</div></fieldset>
          <fieldset><legend>讲课内容</legend><div className="lesson-choice-grid">{lessonModules.map(m => { const reason = m === 'analysis' || m === 'practice' ? selectedQuestions.length ? selectedQuestions.map(q => lessonAvailability(p, a.id, m, q.id)).find(Boolean) : m === 'practice' ? lessonAvailability(p, a.id, m) : '请先勾选题目' : lessonAvailability(p, a.id, m); return <label key={m} className={'lesson-choice' + (reason ? ' is-unavailable' : '')}><input type="checkbox" checked={(selection.modules[a.id] || []).includes(m)} disabled={busy || !!reason && !(selection.modules[a.id] || []).includes(m)} onChange={e => toggleModule(a.id, m, e.target.checked)}/><span>{lessonModuleNames[m]}<small>{reason || '已完成，可加入'}</small></span></label>; })}</div></fieldset>
        </div>}
      </section>; })}
      {!p.passages.length && <p className="lesson-empty">请先整理试卷并生成讲义。</p>}
    </div><aside className="lesson-summary"><h2>本次课件</h2><p>原文、题面、讲评与练习答案按授课顺序排好；内容较长时自动接续到下一页。</p><div className="lesson-summary-count"><strong>{selection.passageIds.length}</strong><span>篇材料</span><strong>{selection.questionIds.length}</strong><span>道题</span><strong>{pages || '—'}</strong><span>页课件</span></div>{issues.length ? <div className="lesson-issues" role="status"><strong>请调整所选内容</strong><ul>{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div> : <p className="lesson-ready" role="status">所选内容可以放映和导出。</p>}<div className="lesson-setup-actions"><button className="primary" disabled={busy || !pages} onClick={onPresent}><Play size={17}/>开始授课</button><button disabled={busy || !pages} onClick={onExport}><Download size={17}/>输出可编辑 PPT</button><button disabled={busy} onClick={onBack}>返回教案</button></div></aside></div>
  </main>;
}
