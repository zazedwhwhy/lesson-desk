import React from 'react';
import {applicableChineseModules,chineseSlides,type ChineseData} from '../core/chinese';
import {chineseLessonNames,chineseLessonReason,defaultChineseLessonSelection,resolveChineseLessonSelection,type ChineseLessonModule,type ChineseLessonSelection} from '../core/chinese-lesson-selection';
import {LessonSetupView,type LessonSetupViewProps} from './LessonSetupView';

type Props=Pick<LessonSetupViewProps,'template'|'onTemplate'|'onTemplatePending'|'busy'|'onPresent'|'onExport'|'onBack'>&{data:ChineseData;selection:ChineseLessonSelection;onChange:(s:ChineseLessonSelection)=>void};
const toggle=(ids:string[],id:string,checked:boolean)=>checked?[...new Set([...ids,id])]:ids.filter(x=>x!==id);
export function ChineseLessonSetup({data:d,selection:s,onChange,...props}:Props){
 const resolved=resolveChineseLessonSelection(d,s);let pages=0;
 if(!resolved.issues.length)try{pages=chineseSlides(d,resolved.ids,props.template.layout).length;}catch(e){resolved.issues.push(e instanceof Error?e.message:String(e));}
 const groups=d.groups.map(g=>({id:g.id,title:g.title,chosen:s.groupIds.includes(g.id),questions:g.questions.filter(q=>!q.excluded).map(q=>({id:q.id,number:q.number,selected:s.questionIds.includes(q.id),reason:chineseLessonReason(d,g,'analysis',[q.id])})),modules:(['source',...applicableChineseModules(g)] as ChineseLessonModule[]).map(m=>({id:m,name:chineseLessonNames[m],selected:(s.modules[g.id]||[]).includes(m),reason:chineseLessonReason(d,g,m,s.questionIds)}))}));
 return <LessonSetupView {...props} groups={groups} pages={pages} issues={resolved.issues}
  toggleGroup={(id,checked)=>{const defaults=defaultChineseLessonSelection(d),g=d.groups.find(g=>g.id===id)!;onChange({groupIds:toggle(s.groupIds,id,checked),questionIds:checked?[...new Set([...s.questionIds,...defaults.questionIds.filter(q=>g.questions.some(x=>x.id===q))])]:s.questionIds.filter(q=>!g.questions.some(x=>x.id===q)),modules:{...s.modules,[id]:checked?defaults.modules[id]:[]}});}}
  toggleQuestion={(id,checked)=>onChange({...s,questionIds:toggle(s.questionIds,id,checked)})}
  toggleModule={(gid,m,checked)=>onChange({...s,modules:{...s.modules,[gid]:toggle(s.modules[gid]||[],m,checked) as ChineseLessonModule[]}})}/>;
}
