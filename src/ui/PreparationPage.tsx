import React from 'react';

type PreparationPageProps = {
  questionCount: number;
  pendingCount: number;
  organize: React.ReactNode;
  reports: React.ReactNode;
  materials: React.ReactNode;
  questions: React.ReactNode;
  checks: React.ReactNode;
  generation: React.ReactNode;
  outputs: React.ReactNode;
};

export function PreparationPage({
  organize, reports, materials, questions, questionCount, pendingCount, checks, generation, outputs,
}: PreparationPageProps){
 const questionsRef=React.useRef<HTMLDetailsElement>(null);
 const checksRef=React.useRef<HTMLDetailsElement>(null);
 return <main className="review preparation-workspace" data-screen-label="整理材料">
  <div className="review-heading"><div><h1>备课材料</h1></div><div className="actions">{organize}</div></div>
  <nav className="prep-steps paper-tabs" aria-label="备课步骤"><a href="#prepare-materials">上传材料</a><a href="#prepare-questions" onClick={()=>{if(questionsRef.current)questionsRef.current.open=true;}}>核对题目</a><a href="#prepare-checks" onClick={()=>{if(checksRef.current)checksRef.current.open=true;}}>校对与修正</a><a href="#prepare-generation">生成教学内容</a><a href="#prepare-output">导出与备份</a></nav>
  {reports}
  <div className="review-grid paper-sheet" id="prepare-materials">{materials}<details className="prep-question-fold" ref={questionsRef} id="prepare-questions"><summary>题目与答案 <small>{questionCount} 题{pendingCount>0&&` · ${pendingCount} 题待核对`}</small></summary>{questions}</details></div>
  <details ref={checksRef} className="prep-checks paper-sheet" id="prepare-checks"><summary>校对报告与修改记录</summary>{checks}</details>
  {generation}{outputs}
 </main>;
}
