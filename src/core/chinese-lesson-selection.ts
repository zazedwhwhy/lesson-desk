import {applicableChineseModules,chineseAvailable,chineseModuleNames,type ChineseData,type ChineseGroup,type ChineseModule} from './chinese';

export type ChineseLessonModule='source'|ChineseModule;
export type ChineseLessonSelection={groupIds:string[];questionIds:string[];modules:Record<string,ChineseLessonModule[]>};
export const chineseLessonNames:Record<ChineseLessonModule,string>={source:'原文与原页图片',...chineseModuleNames};
export function latestChineseVersion(g:ChineseGroup,module:ChineseModule,questionId?:string){
 return g.versions.filter(v=>v.module===module&&v.questionId===questionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1);
}
export function chineseLessonReason(d:ChineseData,g:ChineseGroup,module:ChineseLessonModule,questionIds:string[]):string|null{
 if(module==='source')return g.materials.some(m=>m.image&&!m.imageConfirmed)?'图片尚未核对':g.materials.some(m=>m.text.trim()||m.image)?null:'尚无原文';
 if(!applicableChineseModules(g).includes(module))return '不适用于本组材料';
 const perQuestion=module==='analysis'||module==='practice';
 const qs=g.questions.filter(q=>questionIds.includes(q.id));
 if(perQuestion&&!qs.length)return '请先勾选题目';
 const targets=perQuestion?qs.map(q=>q.id):[undefined];
 for(const id of targets){
  const q=g.questions.find(q=>q.id===id);
  if(q?.excluded)return '所选题目已排除';
  if(q&&!q.confirmed)return '题面尚未核对';
  const v=latestChineseVersion(g,module,id);
  if(!v)return '尚未生成';
  if(!chineseAvailable(d,g,v))return '讲义未确认、待核实或已过期';
 }
 return null;
}
export function defaultChineseLessonSelection(d:ChineseData):ChineseLessonSelection{
 const s:ChineseLessonSelection={groupIds:[],questionIds:[],modules:{}};
 for(const g of d.groups){
  const ids=g.questions.filter(q=>!q.excluded&&q.confirmed&&chineseLessonReason(d,g,'analysis',[q.id])===null).map(q=>q.id);
  const modules:ChineseLessonModule[]=['source',...applicableChineseModules(g)];
  s.modules[g.id]=modules.filter(m=>chineseLessonReason(d,g,m,ids)===null);
  if(s.modules[g.id].length){s.groupIds.push(g.id);s.questionIds.push(...ids);}
 }
 return s;
}
export function resolveChineseLessonSelection(d:ChineseData,s:ChineseLessonSelection):{ids:string[];issues:string[]}{
 const ids:string[]=[],issues:string[]=[];
 if(s.groupIds.some(id=>!d.groups.some(g=>g.id===id)))issues.push('所选材料组已不存在，请重新编排');
 if(s.questionIds.some(id=>!d.groups.some(g=>g.questions.some(q=>q.id===id))))issues.push('所选题目已不存在，请重新编排');
 for(const g of d.groups.filter(g=>s.groupIds.includes(g.id))){
  const qs=g.questions.filter(q=>s.questionIds.includes(q.id));
  if(qs.some(q=>q.excluded))issues.push(g.title+'：所选题目已排除');
  for(const m of s.modules[g.id]||[]){
   const reason=chineseLessonReason(d,g,m,s.questionIds);
   if(reason){issues.push(`${g.title} · ${chineseLessonNames[m]}：${reason}`);continue;}
   if(m==='source')ids.push('source:'+g.id);
   else if(m==='analysis'||m==='practice')for(const q of qs)ids.push(latestChineseVersion(g,m,q.id)!.id);
   else ids.push(latestChineseVersion(g,m)!.id);
  }
 }
 if(!ids.length&&!issues.length)issues.push('请至少选择一项有效内容');
 return {ids:[...new Set(ids)],issues:[...new Set(issues)]};
}
