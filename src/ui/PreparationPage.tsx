import React from 'react';

export function PreparationPage({organize,materials,questions,checks,generation,outputs}:{organize:React.ReactNode;materials:React.ReactNode;questions:React.ReactNode;checks:React.ReactNode;generation:React.ReactNode;outputs:React.ReactNode}){
 return <main className="review preparation-workspace" data-screen-label="整理材料">
  <div className="review-heading"><div><h1>整理材料，准备本次讲义</h1><p>先核对材料与题目，再选择生成内容，最后编排课堂课件。</p></div><div className="actions">{organize}</div></div>
  <nav className="prep-steps" aria-label="备课步骤"><a href="#prepare-materials">材料与题目</a><a href="#prepare-checks">校对与修正</a><a href="#prepare-generation">生成教学内容</a><a href="#prepare-output">导出与备份</a></nav>
  <div className="review-grid" id="prepare-materials">{materials}{questions}</div>
  <details className="prep-checks" id="prepare-checks"><summary>校对与修正 · 查看完整性检查、AI 校对和修改记录</summary>{checks}</details>
  {generation}{outputs}
 </main>;
}
