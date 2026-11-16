import React from 'react';
import type {Project} from '../core/model';
import {organizationCoverageIssues} from '../core/organization-coverage';
import {pendingOcrPages} from '../core/source-fidelity';
export function OrganizationNotice({project,busy,recover}:{project:Project;busy:boolean;recover:()=>void}){
 const issues=[...new Set([...organizationCoverageIssues(project),...(project.organizationIssues||[])])];
 const hasQuestions=project.subject==='chemistry'?!!project.chemistry?.questions.length:!!project.questions.length;
 if(!hasQuestions||!issues.length)return null;
 return <div className="notice" role="status"><div><strong>整理覆盖检查：有遗漏或待核实项</strong><details><summary>查看整理报告（{issues.length}项）</summary><ul>{issues.map((text,i)=><li key={i}>{text}</li>)}</ul></details><button disabled={busy||project.sources.some(s=>!!s.ocrPages?.length||!!pendingOcrPages(s).length)} onClick={recover}>补齐遗漏题目（保留已有讲评）</button></div></div>;
}
