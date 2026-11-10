import React, { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { checkIntegrity, proofreadFingerprint, type IntegrityIssue } from '../core/proofread';
import type { Project, Settings } from '../core/model';
import { CorrectionHistory } from './CorrectionHistory';

export type ReviewLocation = Pick<IntegrityIssue, 'questionId'|'passageId'|'sourceId'|'blockId'>;
export function ProofreadPanel({ p, settings, busy, generate, correct, undo, locate }: {
  p: Project; settings: Settings; busy: boolean; generate: (includeExplanations:boolean)=>void; correct:(includeExplanations:boolean)=>void;undo:()=>void; locate:(where:ReviewLocation)=>void;
}) {
  const local=useMemo(()=>checkIntegrity(p),[p]);
  const [include,setInclude]=useState(p.proofread?.includeExplanations??false);
  const report=p.proofread, stale=!!report&&report.inputSnapshot!==proofreadFingerprint(p,report.includeExplanations);
  const ready=p.questions.length>0&&p.sources.some(s=>s.blocks.some(b=>b.text.trim()))&&!p.sources.some(s=>s.ocrPages?.length);
  return <section className="proofread-panel" aria-label="试卷校对">
    <div className="proofread-heading"><div><h2>试卷校对</h2><p>已整理 {p.questions.length} 题 · 本地检查{local.length?`发现 ${local.length} 项待核查`:'未发现明显缺漏'}</p></div>
      <div className="proofread-controls"><label><input type="checkbox" checked={include} disabled={busy} onChange={e=>setInclude(e.target.checked)}/>同时复核已有讲解</label>
        <button disabled={busy||!ready} onClick={()=>generate(include)}><ClipboardCheck size={17}/>AI 校对试卷</button><button className="primary" disabled={busy||!ready} onClick={()=>correct(include)}>AI 自动修正</button></div></div>
    <p className="proofread-scope">点击后将向 {settings.provider}（{settings.model||'尚未设置模型'}）发送原材料的提取文字、整理后的题目与答案{include?'及已有讲解':''}。校对建议需人工核查；扫描文字仍需对照原页。</p>
    <p className="proofread-scope">自动修正会先校对、应用有来源的修改，再复核一次；保留修改记录并支持撤销，不自动勾选“已核对”。无依据的问题仍会列出。</p>
    {!ready&&<p className="proofread-empty">先上传材料、完成扫描识别并整理题目，即可进行 AI 校对。</p>}
    <details className="proofread-section" open={local.length>0}><summary>本地完整性检查 · {local.length} 项</summary>
      {!local.length?<p>未发现可自动识别的完整性问题。节选、复杂版式和题意仍需人工检查。</p>:<ol className="proofread-findings">{local.map(issue=><li key={issue.id}>
        <div className="proofread-finding-head"><strong>{issue.severity==='error'?'需处理':'待核实'}</strong><div><button onClick={()=>locate(issue.questionId?{questionId:issue.questionId}:issue)}>{issue.questionId?'定位题目':issue.sourceId?'查看原材料':issue.passageId?'定位材料':'查看题目'}</button>{issue.questionId&&issue.sourceId&&<button onClick={()=>locate({sourceId:issue.sourceId,blockId:issue.blockId})}>查看答案出处</button>}</div></div><p>{issue.message}</p>
      </li>)}</ol>}
    </details>
    <details className="proofread-section" open={!!report}><summary>AI 校对报告{report?` · ${report.result.findings.length} 项提示`:' · 尚未运行'}</summary>
      {!report?<p>AI 将独立对照提取后的材料复核。报告不会修改题目、参考答案或核对状态。</p>:<>
        <p className="proofread-meta">{new Date(report.createdAt).toLocaleString()} · {report.provider} / {report.model} · {report.includeExplanations?'含已有讲解':'题目与答案'}</p>
        {stale&&<p className="proofread-stale" role="status">材料、题目或讲解已修改，本报告已过期，请重新校对。</p>}
        <p>{report.result.coverage==='complete'?'已完成本次检查范围':'仅完成部分检查'}：{report.result.checkedQuestionIds.length} / {p.questions.length} 题，{report.result.checkedSourceIds.length} / {p.sources.length} 份来源。{!report.result.findings.length?'本次未发现问题，不等于教师已核对。':''}</p>
        {!!report.result.limitations.length&&<div className="proofread-limitations"><strong>检查限制</strong>{report.result.limitations.map((text,i)=><p key={i}>{text}</p>)}</div>}
        <ol className="proofread-findings">{report.result.findings.map((issue,i)=><li key={i}>
          <div className="proofread-finding-head"><strong>AI 提示 · {issue.severity==='error'?'需处理':'待核实'}</strong><div>{issue.questionIds.map(id=><button key={id} onClick={()=>locate({questionId:id})}>定位第 {p.questions.find(q=>q.id===id)?.number||'?'} 题</button>)}{!issue.questionIds.length&&issue.passageIds.map(id=><button key={id} onClick={()=>locate({passageId:id})}>定位材料</button>)}</div></div>
          <p>{issue.description}</p><p className="proofread-suggestion">建议：{issue.suggestion}</p>
          {issue.evidence.length?issue.evidence.map((ref,j)=><div className="proofread-evidence" key={j}><q>{ref.quote}</q><button onClick={()=>locate({sourceId:ref.sourceId,blockId:ref.blockId})}>查看出处 · {p.sources.find(s=>s.id===ref.sourceId)?.name}</button></div>):<p className="proofread-no-evidence">未提供可核实的来源引用，仅作人工排查提示。</p>}
        </li>)}</ol>
      </>}
    </details>
    <CorrectionHistory p={p} busy={busy} undo={undo}/>
  </section>;
}
