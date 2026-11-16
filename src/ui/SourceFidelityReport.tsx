import React from 'react';
import type {Project} from '../core/model';

export function SourceFidelityReport({project,actions}:{project:Project;actions?:React.ReactNode}){
 const issues=project.sourceFidelityIssues||[];
 if(!issues.length)return null;
 return <section className="panel" aria-label="原题一致性检查报告">
  {actions}<details><summary>原题一致性检查 · {issues.length} 处差异待核对（展开查看）</summary>
  <p role="status">其他题目已继续整理。以下为本次整理时发现的差异，候选内容已保留；请对照原材料，在题目与答案中修正并确认。此报告保留当时的检查结果，不代表修改后的状态。</p>
  {issues.map((issue,index)=><details key={index}>
   <summary>{issue.location} · 与来源不一致或有遗漏</summary>
   <p>来源文字（无法精确定位题号时展示来源范围）：</p>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:260,overflow:'auto'}}>{issue.expected||'来源中没有可匹配的文字'}</pre>
   <p>AI 整理文字：</p>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:260,overflow:'auto'}}>{issue.received||'（空白）'}</pre>
  </details>)}
 </details></section>;
}
