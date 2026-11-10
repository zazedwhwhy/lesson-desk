import React from 'react';
import {exerciseNames,type Exercise}from'../core/exercise';
import{optionEntries}from'../core/options';
export type ExerciseField='material'|'stem'|'options'|'answer'|'analysis'|'point';
export function ExerciseCard({exercise:e,children,edit=false,onEdit}:{exercise:Exercise;children?:React.ReactNode;edit?:boolean;onEdit?:(field:ExerciseField,value:string|string[])=>void}){
  const field=(name:ExerciseField,value:string,label:string,english=false)=>edit?<label>{label}<textarea aria-label={label} defaultValue={value} onBlur={ev=>onEdit?.(name,ev.target.value)}/></label>:<p className={english?'exercise-english':''} lang={english?'en':undefined}>{value}</p>;
  return <section className="generated-exercise" aria-label="独立英文同类练习">
    <div className="exercise-caption"><strong>{exerciseNames[e.kind]} · AI 新编</strong><span>{e.skill}</span></div>
    {field('material',e.material,e.kind==='listening'?'新对话文字稿':'新材料',true)}
    {field('stem',e.stem,'英文题干',true)}
    {edit?<label>练习选项<textarea aria-label="练习选项" defaultValue={e.options.join('\n')} onBlur={ev=>onEdit?.('options',ev.target.value.split('\n').filter(Boolean))}/></label>:optionEntries(e.options).map(o=><p className="exercise-english exercise-option" lang="en" key={o.label}>{o.label}. {o.text}</p>)}
    {children}
    <details className="answer-fold"><summary>查看练习参考答案</summary>{field('answer',e.answer,'练习答案',true)}{field('analysis',e.analysis,'练习解析')}{field('point',e.point,'迁移考点')}</details>
  </section>;
}
