import React from 'react';
import type {Project} from '../core/model';
import {planChineseSections,missingChineseQuestions} from '../core/chinese-organization';
export function ChineseOrganizationNotice({project:p,busy,recover}:{project:Project;busy:boolean;recover:()=>void}){
 const missing=planChineseSections(p).flatMap(section=>{const numbers=missingChineseQuestions(section,(p.chinese?.groups||[]).filter(g=>g.materials.some(m=>m.sourceId===section.source.id)));return numbers.length?[`${section.title}：第 ${numbers.join('、')} 题尚未整理`]:[];});
 const issues=[...missing,...(p.chinese?.organizationIssues||[])];
 if(!p.chinese?.groups.length||!issues.length)return null;
 return <div className="notice" role="status"><div><strong>整卷尚未整理完整</strong> · 原材料仍保留，可补齐后续篇目。<details><summary>查看遗漏与整理报告（{issues.length}项）</summary><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details><button disabled={busy||p.sources.some(s=>!!s.ocrPages?.length)} onClick={recover}>补齐剩余篇目（保留已有讲评）</button></div></div>;
}
