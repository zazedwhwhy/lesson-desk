import {LessonSetupView} from './LessonSetupView';
import type {PptTemplate} from '../core/ppt-templates';
import React from 'react';
import type { Project } from '../core/model';
import { buildLessonDeck, lessonAvailability, lessonModuleNames, lessonModules, lessonSelectionIssues, type LessonModule, type LessonSelection } from '../core/lesson-deck';

type Props = { template:PptTemplate;onTemplate:(value:PptTemplate)=>void;onTemplatePending:(pending:boolean)=>void; project: Project; selection: LessonSelection; onChange: (next: LessonSelection) => void; onPresent: () => void; onExport: () => void; onBack: () => void; busy: boolean };
export function LessonSetup({ project: p, selection, onChange, onPresent, onExport, onBack, busy,template,onTemplate,onTemplatePending }: Props) {
  const issues = lessonSelectionIssues(p, selection);
  let pages = 0;
  if (!issues.length) { try { pages = buildLessonDeck(p, selection,template.layout).length; } catch(e) { issues.push(e instanceof Error?e.message:String(e)); } }
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
  const groups=p.passages.map(a=>{
    const questions=p.questions.filter(q=>q.passageId===a.id&&!q.excluded),chosen=questions.filter(q=>selection.questionIds.includes(q.id));
    return {id:a.id,title:a.title,chosen:selection.passageIds.includes(a.id),questions:questions.map(q=>({id:q.id,number:q.number,selected:selection.questionIds.includes(q.id),reason:lessonAvailability(p,a.id,'analysis',q.id)})),modules:lessonModules.map(m=>({id:m,name:lessonModuleNames[m],selected:(selection.modules[a.id]||[]).includes(m),reason:m==='analysis'||m==='practice'?chosen.length?chosen.map(q=>lessonAvailability(p,a.id,m,q.id)).find(Boolean)||null:m==='practice'?lessonAvailability(p,a.id,m):'请先勾选题目':lessonAvailability(p,a.id,m)}))};
  });
  return <LessonSetupView groups={groups} pages={pages} issues={issues} busy={busy} template={template} onTemplate={onTemplate} onTemplatePending={onTemplatePending} toggleGroup={togglePassage} toggleQuestion={toggleQuestion} toggleModule={(pid,module,checked)=>toggleModule(pid,module as LessonModule,checked)} onPresent={onPresent} onExport={onExport} onBack={onBack}/>;
}
