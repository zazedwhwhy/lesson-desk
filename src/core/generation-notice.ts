import type {Project} from './model';
export function generationNotice(p:Project){
 const tasks=p.job.tasks||[],complete=tasks.filter(t=>t.state==='complete').length,failed=tasks.filter(t=>t.state==='failed').length,pending=tasks.length-complete-failed;
 const title=p.job.state==='cancelled'?'生成已取消':p.job.state==='complete'?'生成完成':p.job.stopReason?'生成已暂停':'生成结束，有内容待处理';
 return {title,body:p.title+'：已保存 '+complete+'/'+tasks.length+' 项'+(failed?'，失败 '+failed+' 项':'')+(pending?'，未完成 '+pending+' 项':'')+'。点击返回查看。'};
}
