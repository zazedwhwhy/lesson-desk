import type {ChineseData} from './chinese';
import type {ReviewAction} from './review';

export function applyChineseReviewBatch(original:ChineseData,ids:string[],action:ReviewAction){
 if(!ids.length)throw Error('请先勾选需要操作的题目');
 if(ids.some(id=>!original.groups.some(g=>g.questions.some(q=>q.id===id))))throw Error('所选题目已变化，请重新选择');
 const data=structuredClone(original),materials=data.groups.flatMap(g=>g.materials),skipped:string[]=[];let changed=0;
 for(const q of data.groups.flatMap(g=>g.questions).filter(q=>ids.includes(q.id))){
  const before=[q.confirmed,q.excluded].join();
  if(action==='confirm'){
   const related=materials.filter(m=>q.materialIds.includes(m.id));
   if(q.excluded||!q.stem.trim()||q.materialIds.some(id=>!related.some(m=>m.id===id))||related.some(m=>m.image&&!m.imageConfirmed)){
    skipped.push('第 '+q.number+' 题：请核对题干、关联材料及图片；排除题目请先恢复');continue;
   }
   q.confirmed=true;
  }else if(action==='unconfirm')q.confirmed=false;
  else if(action==='exclude'){q.excluded=true;q.confirmed=false;}
  else if(action==='restore'&&q.excluded){q.excluded=false;q.confirmed=false;}
  if(before!==[q.confirmed,q.excluded].join())changed++;
 }
 return {data,changed,skipped};
}
