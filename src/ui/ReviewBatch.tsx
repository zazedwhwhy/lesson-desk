import React, { useEffect, useRef } from 'react';
import type { Project } from '../core/model';
import type { ReviewAction } from '../core/review';

export function SelectionBox({ ids, selected, setSelected, label, disabled = false }: {
  ids: string[]; selected: string[]; setSelected: (ids: string[]) => void; label: string; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null), count = ids.filter(id => selected.includes(id)).length;
  useEffect(() => { if (ref.current) ref.current.indeterminate = count > 0 && count < ids.length; }, [count, ids.length]);
  return <label className="selection-box"><input ref={ref} type="checkbox" checked={!!ids.length && count === ids.length}
    disabled={disabled || !ids.length} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...ids])] : selected.filter(id => !ids.includes(id)))}/>{label}</label>;
}

export function ReviewBatch({ p, questions, hint, selected, setSelected, busy, apply, report }: {
  p?: Project; questions?:{id:string}[]; hint?:string; selected: string[]; setSelected: (ids: string[]) => void; busy: boolean;
  apply: (action: ReviewAction) => void; report: string[];
}) {
  const ids = (questions||p?.questions||[]).map(q => q.id), count = ids.filter(id => selected.includes(id)).length;
  return <section className="review-batch" aria-label="批量操作">
    <div className="batch-selection"><SelectionBox ids={ids} selected={selected} setSelected={setSelected} disabled={busy} label="选择整卷"/>
      <span>已选 {count} / {ids.length} 题</span>
      <button disabled={busy || !count} onClick={() => setSelected([])}>清空选择</button></div>
    <div className="batch-actions">
      <button disabled={busy || !count} onClick={() => apply('confirm')}>核对所选</button>
      <button disabled={busy || !count} onClick={() => apply('exclude')}>排除所选</button>
      <button disabled={busy || !count} onClick={() => apply('restore')}>恢复所选</button>
      <button disabled={busy || !count} onClick={() => apply('unconfirm')}>取消核对</button>
    </div>
    <p>{hint||'核对前请对照原卷与答案；缺答案等问题会跳过。恢复题目后需重新核对。'}</p>
    {!!report.length && <details className="batch-report" open><summary>本次操作结果</summary>{report.map((line, i) => <p key={i}>{line}</p>)}</details>}
  </section>;
}
