import React from 'react';
import { Undo2 } from 'lucide-react';
import { correctionFingerprint } from '../core/correction';
import type { Project } from '../core/model';

export function CorrectionHistory({p,busy,undo}:{p:Project;busy:boolean;undo:()=>void}){
  const records=p.corrections||[],last=[...records].reverse().find(r=>!r.undoneAt&&r.changes.length);
  if(!records.length)return null;
  const canUndo=!!last&&last.afterFingerprint===correctionFingerprint(p);
  return <section className="correction-history" aria-label="自动修改记录">
    <div className="correction-history-heading"><h3>自动修改记录</h3><button disabled={busy||!canUndo} onClick={undo}><Undo2 size={15}/>撤销上次自动修正</button></div>
    {last&&!canUndo&&<p className="correction-note">自动修正后已有新的编辑。为保留这些编辑，请在记录中对照原值恢复。</p>}
    <details open><summary>共 {records.length} 次 · 原始文件始终保留</summary>{[...records].reverse().map(r=><section className="correction-record" key={r.id}>
      <p className="correction-meta">{new Date(r.createdAt).toLocaleString()} · {r.model} · 修改 {r.changes.length} 项{r.undoneAt?' · 已撤销':''}</p>
      {!r.undoneAt&&<p className={r.recheck==='failed'||r.recheck==='cancelled'?'correction-warning':''}>{r.recheck==='complete'?'修改已保存，并已再次校对；请查看校对报告。':r.recheck==='pending'?'修改已保存，再次校对尚未完成。':r.recheck==='not_required'?'没有可安全应用的修改。':`修改已保存，但再次校对${r.recheck==='cancelled'?'已取消':'失败'}：${r.recheckError}`}</p>}
      {r.changes.map((c,i)=><details className="correction-change" key={i}><summary>{c.target}</summary><p>{c.reason}</p><div className="correction-comparison"><div><h4>修改前</h4><pre>{c.before||'（无）'}</pre></div><div><h4>修改后</h4><pre>{c.after||'（无）'}</pre></div></div></details>)}
      {!!r.unresolved.length&&<div className="correction-unresolved"><strong>仍待处理</strong><ul>{r.unresolved.map((text,i)=><li key={i}>{text}</li>)}</ul></div>}
    </section>)}</details>
  </section>;
}
