import React from 'react';
import {friendlyError} from '../core/errors';
import type {Project} from '../core/model';
import {preparationProgress} from './preparation-state';

type Item={id:string;title:string;state:'pending'|'running'|'complete'|'failed';error:string};
export function PreparationProgress({tasks,job,active=false,cancelling=false}:{tasks:Item[];job?:Project['job'];active?:boolean;cancelling?:boolean}) {
  const progress=preparationProgress(tasks,job,active,cancelling);
  return <div className="prep-progress">
    <div role="status" aria-live="polite"><strong>{progress.state}</strong>{tasks.length>0&&<span> · 已保存 {progress.complete} / {progress.total} 项{progress.failed>0&&` · 失败 ${progress.failed} 项`}{progress.pending>0&&` · 等待 ${progress.pending} 项`}</span>}
      {active&&tasks.find(t=>t.state==='running')&&<p>当前：{tasks.find(t=>t.state==='running')!.title}</p>}
      {job?.stopReason&&<p className="error-text">{friendlyError(job.stopReason)}。请处理服务问题后再继续。</p>}
    </div>
    {!!tasks.length&&<details><summary>查看逐项进度与失败原因</summary><ol className="prep-task-list">{tasks.map(t=><li key={t.id}><span>{t.title}</span><strong>{{pending:'未执行',running:active?'正在生成':'未完成',complete:'已保存',failed:'失败'}[t.state]}</strong>{t.error&&<p className="error-text">{friendlyError(t.error)}</p>}</li>)}</ol></details>}
    {!!progress.unfinished&&!active&&<p className="prep-note">已保存的内容保留。继续时使用上次范围，只处理失败或未完成项；材料或核对状态变化后，需要重新选择生成。</p>}
  </div>;
}
