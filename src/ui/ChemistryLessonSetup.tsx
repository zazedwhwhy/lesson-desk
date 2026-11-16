import React from 'react';
import {chemModules,chemSlides,type Chemistry} from '../core/chemistry';
import {chemLessonNames,chemLessonReason,defaultChemSelection,resolveChemSelection,type ChemSelection,type ChemLessonModule} from '../core/chemistry-workflow';
import {LessonSetupView,type LessonSetupViewProps} from './LessonSetupView';
type Props=Pick<LessonSetupViewProps,'template'|'onTemplate'|'onTemplatePending'|'busy'|'onPresent'|'onExport'|'onBack'>&{data:Chemistry;selection:ChemSelection;onChange:(s:ChemSelection)=>void};
export function ChemistryLessonSetup({data:d,selection:s,onChange,...props}:Props){
 const resolved=resolveChemSelection(d,s);let pages=0;if(!resolved.issues.length)try{pages=chemSlides(d,resolved.ids,props.template.layout).length;}catch(e){resolved.issues.push(e instanceof Error?e.message:String(e));}
 const toggle=(id:string,yes:boolean)=>{const defaults=defaultChemSelection(d);onChange({questionIds:yes?[...new Set([...s.questionIds,id])]:s.questionIds.filter(x=>x!==id),modules:{...s.modules,[id]:yes?(defaults.modules[id]||['source']):[]}});};
 const groups=d.questions.filter(q=>!q.excluded).map(q=>({id:q.id,title:'第 '+q.number+' 题',chosen:s.questionIds.includes(q.id),questions:[{id:q.id,number:q.number,selected:s.questionIds.includes(q.id),reason:chemLessonReason(q,'analysis')}],modules:(['source',...chemModules] as ChemLessonModule[]).map(m=>({id:m,name:chemLessonNames[m],selected:(s.modules[q.id]||[]).includes(m),reason:chemLessonReason(q,m)}))}));
 return <LessonSetupView {...props} groups={groups} pages={pages} issues={resolved.issues} toggleGroup={toggle} toggleQuestion={toggle} toggleModule={(id,m,yes)=>onChange({...s,modules:{...s.modules,[id]:yes?[...new Set([...(s.modules[id]||[]),m as ChemLessonModule])]:(s.modules[id]||[]).filter(x=>x!==m)}})}/>;
}
