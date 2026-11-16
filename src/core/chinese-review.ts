import type {ChineseData,ChineseGroup} from './chinese';
import type {ReviewAction} from './review';

export function chineseQuestionIssues(d:ChineseData,q:ChineseGroup['questions'][number]){
 const materials=d.groups.flatMap(g=>g.materials),related=materials.filter(m=>q.materialIds.includes(m.id)),issues:string[]=[];
 if(q.excluded)issues.push('本题已排除，请先恢复');
 if(!q.stem.trim())issues.push('题干为空');
 if(q.materialIds.some(id=>!related.some(m=>m.id===id)))issues.push('关联材料不存在');
 if(related.some(m=>m.image&&!m.imageConfirmed))issues.push('关联图片尚未核对');
 return issues;
}
export function splitChineseQuestion(d:ChineseData,gid:string,qid:string,newId:string){
 const g=d.groups.find(g=>g.id===gid),index=g?.questions.findIndex(q=>q.id===qid)??-1;
 if(!g||index<0)throw Error('题目已不存在');
 const q=g.questions[index];g.questions.splice(index+1,0,{...structuredClone(q),id:newId,number:q.number+'b',answer:'',answerSource:'none',confirmed:false});
}
export function mergeChineseQuestion(d:ChineseData,gid:string,qid:string){
 const g=d.groups.find(g=>g.id===gid),index=g?.questions.findIndex(q=>q.id===qid)??-1;
 if(!g||index<0)throw Error('题目已不存在');
 const q=g.questions[index],next=g.questions[index+1];if(!next)throw Error('没有同组下一题');
 q.stem+='\n'+next.stem;q.answer=[q.answer,next.answer].filter(Boolean).join('；');q.answerSource=q.answer?'teacher':'none';
 q.materialIds=[...new Set([...q.materialIds,...next.materialIds])];q.options.push(...next.options);q.confirmed=false;
 // Historical versions retain their original question IDs and fingerprints.
 g.questions.splice(index+1,1);
}
export function applyChineseReviewBatch(original:ChineseData,ids:string[],action:ReviewAction){
 if(!ids.length)throw Error('请先勾选需要操作的题目');
 if(ids.some(id=>!original.groups.some(g=>g.questions.some(q=>q.id===id))))throw Error('所选题目已变化，请重新选择');
 const data=structuredClone(original),skipped:string[]=[];let changed=0;
 for(const q of data.groups.flatMap(g=>g.questions).filter(q=>ids.includes(q.id))){
  const before=[q.confirmed,q.excluded].join();
  if(action==='confirm'){
   const issues=chineseQuestionIssues(data,q);
   if(issues.length){skipped.push('第 '+q.number+' 题：'+issues.join('；'));continue;}
   q.confirmed=true;
  }else if(action==='unconfirm')q.confirmed=false;
  else if(action==='exclude'){q.excluded=true;q.confirmed=false;}
  else if(action==='restore'&&q.excluded){q.excluded=false;q.confirmed=false;}
  if(before!==[q.confirmed,q.excluded].join())changed++;
 }
 return {data,changed,skipped};
}
