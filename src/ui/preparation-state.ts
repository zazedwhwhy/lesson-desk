import type {Project} from '../core/model';
import {applicableChineseModules, type ChineseData, type ChineseModule} from '../core/chinese';

type Task = {state: 'pending'|'running'|'complete'|'failed'};
export function chineseReviewScope(d:ChineseData,selected:string[]){
 const scoped=d.groups.flatMap(g=>g.questions).filter(q=>!selected.length||selected.includes(q.id));
 const questionIds=scoped.filter(q=>q.confirmed&&!q.excluded).map(q=>q.id);
 const groupIds=d.groups.filter(g=>g.questions.some(q=>questionIds.includes(q.id))||!g.questions.length&&!selected.length).map(g=>g.id);
 return {questionIds,groupIds,unconfirmed:scoped.filter(q=>!q.confirmed&&!q.excluded).length,excluded:scoped.filter(q=>q.excluded).length};
}
export function preparationProgress(tasks: readonly Task[], job?: Pick<Project['job'],'state'|'stopReason'>, active=false, cancelling=false) {
  const complete=tasks.filter(t=>t.state==='complete').length;
  const failed=tasks.filter(t=>t.state==='failed').length;
  const pending=tasks.filter(t=>t.state==='pending').length;
  const running=tasks.filter(t=>t.state==='running').length;
  // A persisted running task alone does not prove a request is still active.
  const state=active ? cancelling?'正在取消':'正在生成'
    : job?.state==='cancelled'?'已取消'
    : job?.stopReason?'服务已暂停'
    : !tasks.length?'尚未生成'
    : complete===tasks.length?'已全部保存，待核对'
    : job?.state==='interrupted'||running?'上次任务已中断'
    : failed ? complete?'部分完成，有失败项':'生成失败'
    : '尚有未完成项';
  return {state,complete,failed,pending,running,total:tasks.length,unfinished:tasks.length-complete};
}

export function chinesePreparationScope(d:ChineseData, groupIds:string[], modules:ChineseModule[], questionIds:string[]) {
  const groups=d.groups.filter(g=>groupIds.includes(g.id));
  const questions=groups.flatMap(g=>g.questions).filter(q=>!q.excluded&&questionIds.includes(q.id));
  const unconfirmed=questions.filter(q=>!q.confirmed).length;
  const taskCount=groups.reduce((sum,g)=>sum+modules.filter(m=>applicableChineseModules(g).includes(m)).reduce((count,m)=>count+(['analysis','practice'].includes(m)?g.questions.filter(q=>!q.excluded&&questionIds.includes(q.id)).length:1),0),0);
  return {groups,questions,unconfirmed,taskCount};
}
