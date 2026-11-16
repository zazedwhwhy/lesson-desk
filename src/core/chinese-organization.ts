import type {Project,Source} from './model';
import type {ChineseGroup} from './chinese';

export type ChineseSection={id:string;title:string;source:Source;numbers:string[]};
const heading=/^\s*(?:[（(][一二三四五六七八九十]+[）)]|[一二三四五六七八九十]+[、．.])[^\n]{0,50}(?:阅读|默写|语言文字|写作|作文|古诗|诗歌|文言文)/;
export function chineseQuestionNumbers(source:Source){
 const rows=source.blocks.flatMap(b=>b.text.split('\n')).flatMap(line=>{const m=line.match(/^\s*(\d{1,3})\s*[.．、]\s*(\S.*)/);return m?[{number:String(Number(m[1])),scored:/[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]/.test(m[2])}]:[];});
 const hasScores=rows.some(r=>r.scored),numbers=rows.filter(r=>!hasScores||r.scored).map(r=>r.number);
 // Explicit section ranges also cover questions whose score is on a separate
 // line, rather than silently excluding them from the completeness check.
 for(const b of source.blocks)for(const match of b.text.matchAll(/完成\s*(\d{1,3})\s*[~～—–-]\s*(\d{1,3})\s*题/g)){
  const from=Number(match[1]),to=Number(match[2]);if(to>=from&&to-from<100)for(let n=from;n<=to;n++)numbers.push(String(n));
 }
 const count=source.blocks[0]?.text.match(/本题共\s*(\d{1,2})\s*小题/),first=rows.find(r=>r.scored);
 if(count&&first)for(let n=0;n<Number(count[1]);n++)numbers.push(String(Number(first.number)+n));
 return [...new Set(numbers)].sort((a,b)=>Number(a)-Number(b));
}
export function planChineseSections(p:Project):ChineseSection[]{
 const sections:ChineseSection[]=[];
 for(const source of p.sources.filter(s=>s.role==='paper')){
  const starts=source.blocks.flatMap((b,i)=>heading.test(b.text)?[i]:[]);
  // PDF text can merge the first heading into a title block. Keep that prefix
  // when it contains questions, while excluding numbered exam instructions.
  if(starts[0]>0&&source.blocks.slice(0,starts[0]).some(b=>/^\s*\d{1,3}\s*[.．、][^\n]*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]/m.test(b.text)||/完成\s*\d{1,3}\s*[~～—–-]\s*\d{1,3}\s*题/.test(b.text)))starts.unshift(0);
  if(!starts.length)starts.push(0);
  for(let n=0;n<starts.length;n++){
   const start=starts[n],blocks=source.blocks.slice(start,starts[n+1]??source.blocks.length),part={...source,blocks},numbers=chineseQuestionNumbers(part);
   if(!numbers.length&&starts.length>1)continue;
   sections.push({id:source.id+':'+(blocks[0]?.id||'all'),title:blocks[0]?.text.split('\n')[0]||source.name,source:part,numbers});
  }
 }
 return sections;
}
const baseNumber=(number:string)=>number.trim().match(/^\d+/)?.[0]||number.trim();
export function missingChineseQuestions(section:ChineseSection,groups:ChineseGroup[]){const actual=new Set(groups.flatMap(g=>g.questions.map(q=>baseNumber(q.number))));return section.numbers.filter(n=>!actual.has(n));}
/** Reuse a complete unchanged material group so adding later sections cannot
 * discard the teacher's existing generated versions or edits. */
export function reusableChineseGroups(section:ChineseSection,groups:ChineseGroup[]){
 const blockIds=new Set(section.source.blocks.map(b=>b.id));
 const candidates=groups.filter(g=>g.materials.length>0&&g.materials.every(m=>m.sourceId===section.source.id&&m.blockIds.length>0&&m.blockIds.every(id=>blockIds.has(id))&&m.text===m.blockIds.map(id=>section.source.blocks.find(b=>b.id===id)!.text).join('\n'))&&g.questions.every(q=>section.numbers.includes(baseNumber(q.number))));
 return section.numbers.length&&!missingChineseQuestions(section,candidates).length?structuredClone(candidates):[];
}
