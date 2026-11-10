import React from 'react';
import type { Project } from '../core/model';
import { friendlyError } from '../core/errors';

export function GenerationStatus({ p }: { p: Project }) {
  if(p.job.tasks){const tasks=p.job.tasks,complete=tasks.filter(t=>t.state==='complete').length,failed=tasks.filter(t=>t.state==='failed').length,pending=tasks.filter(t=>t.state==='pending').length,current=tasks.find(t=>t.state==='running');return <div className="generation-status" aria-live="polite"><p>{p.job.state==='running'?'正在生成':p.job.state==='complete'?'生成完成':p.job.state==='cancelled'?'已取消':p.job.state==='interrupted'?'上次任务已中断':'部分内容未完成'} · 完成 {complete}/{tasks.length} 项{failed>0&&` · 失败 ${failed} 项`}{pending>0&&` · 未执行 ${pending} 项`}</p>{current&&<p>当前：{current.title}</p>}{p.job.stopReason&&<p className="error-text">任务暂停：{p.job.stopReason}</p>}<details><summary>逐项进度与失败原因</summary><ol>{tasks.map(t=><li key={t.id}><strong>{t.title}</strong>：{({complete:'已保存',failed:'失败',pending:'未执行',running:'正在生成'}as const)[t.state]}{t.error&&<p className="error-text">{friendlyError(t.error)}</p>}</li>)}</ol></details>{(failed>0||pending>0)&&<p className="muted">已保存内容可以直接查看。“继续未完成”只处理本项失败或未执行的内容。</p>}</div>;}
  const labels = { idle: '选择内容后即可分项生成', running: '正在生成', complete: '生成完成', partial: '部分完成', failed: '生成失败', cancelled: '任务已取消', interrupted: '上次任务已中断' };
  const errors = Object.entries(p.job.errors);
  return <div className="generation-status" aria-live="polite">
    <p>{labels[p.job.state]}{p.job.state !== 'idle' && ` · 已保存 ${p.job.done.length} 题`}{errors.length > 0 && ` · ${errors.length} 个题组需处理`}</p>
    {!!errors.length && <><p className="muted">已保存的讲解可继续查看。请核查下列原因，再重试失败题组。</p>
      {errors.map(([id, error]) => <details key={id} open><summary>{p.passages.find(a => a.id === id)?.title || id}</summary><p>{friendlyError(error)}</p></details>)}</>}
  </div>;
}
