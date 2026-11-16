import type {Project,Source,Question} from './model';

export type OrganizationTarget={number?:string;type?:'writing'|'continuation';sourceId:string};
export type OrganizationScope={source:Source;targets:OrganizationTarget[];title:string};
export const organizationNumber=(value:string)=>value.trim().replace(/^0+(?=\d)/,'').replace(/[（(].*$/,'').trim();
export const targetLabel=(target:OrganizationTarget)=>target.number?'第 '+target.number+' 题':target.type==='continuation'?'读后续写':'应用文写作';
const sectionHeading=/^\s*(?:第[一二三四五六七八九十\d]+[部分节章]|[一二三四五六七八九十]+[、．]|(?:Part|Section)\s+[A-ZIVX\d]+\b)/i;
function numbers(text:string,english:boolean){
 const found=new Set<string>();
 const rows=[...text.matchAll(/^\s*(\d{1,3})\s*[.．、]\s*(?!\d)(\S.*)/gm)];
 for(const [index,m] of rows.entries()){
  // Numbered exam instructions and page labels are not questions.
  if(/^(?:答题前|考生|本试卷|考试时间|请将|请在答题卡|请填写|请按如下格式|注意事项|满分|(?:写作|续写)?词数|开头和结尾已)/.test(m[2]))continue;
  if(english){
   const body=text.slice(m.index,rows[index+1]?.index??text.length);
   const options=/(?:^|\s)A[.．、)]\s*\S[\s\S]*(?:^|\s)B[.．、)]\s*\S/m.test(body);
   if(!options&&!/[?？]|_{2,}|[（(]\d+(?:\.\d+)?分[）)]/.test(m[2])&&!/^(?:What|Why|How|Which|Who|When|Where|Explain|Describe|Choose|Complete|Fill)\b/i.test(m[2])&&!/假[定设]你是|读后续写/.test(m[2]))continue;
  }
  found.add(String(Number(m[1])));
 }
 if(english){
  for(const m of text.matchAll(/(?:第\s*|questions?\s+|完成\s*)(\d{1,3})\s*(?:[-—–~～至到])\s*(\d{1,3})\s*(?:[题小]|\b)/gi)){
   const from=Number(m[1]),to=Number(m[2]);if(to>=from&&to-from<100)for(let n=from;n<=to;n++)found.add(String(n));
  }
  // Inline blanks often have no separate question row (grammar/seven-choice).
  for(const m of text.matchAll(/_{2,}\s*[（(]?\s*(\d{1,3})\s*[）)]?|\b(\d{1,3})\s*_{2,}/g))found.add(String(Number(m[1]||m[2])));
 }
 return [...found];
}
/** Keep whole sections in both subjects, including shared experimental conditions
 * and reading passages. A numbered row alone is not a safe context boundary. */
export function organizationScopes(p:Project):OrganizationScope[]{
 const result:OrganizationScope[]=[];
 for(const source of p.sources.filter(s=>s.role==='paper')){
  const starts=[0];
  source.blocks.forEach((b,i)=>{if(i&&sectionHeading.test(b.text))starts.push(i);});
  for(let i=0;i<starts.length;i++){
   const blocks=source.blocks.slice(starts[i],starts[i+1]??source.blocks.length),text=blocks.map(b=>b.text).join('\n');
   const targets:OrganizationTarget[]=numbers(text,p.subject==='english').map(number=>({sourceId:source.id,number}));
   if(p.subject==='english'){
    if(/读后续写|续写两段|续写短文/.test(text))targets.push({sourceId:source.id,type:'continuation'});
    if(/应用文写作|书面表达|假[定设]你是李华/.test(text))targets.push({sourceId:source.id,type:'writing'});
   }
   if(targets.length)result.push({source:{...source,blocks},targets,title:source.name+' · '+(blocks[0]?.text.split('\n')[0].slice(0,60)||'试题')});
  }
 }
 return result;
}
export function missingOrganizationTargets(p:Project,targets:OrganizationTarget[]){
 return targets.filter(t=>p.subject==='chemistry'
  ?!p.chemistry?.questions.some(q=>q.sourceId===t.sourceId&&organizationNumber(q.number)===t.number)
  :!p.questions.some(q=>englishQuestionSourceId(p,q)===t.sourceId&&(t.number?organizationNumber(q.number)===t.number:q.type===t.type)));
}
/** Legacy single-paper projects need no migration. With multiple papers, only a
 * unique literal stem binding can recover an absent source id. */
export function englishQuestionSourceId(p:Project,q:Question){
 const sources=p.sources.filter(s=>s.role==='paper');
 if(q.sourceId&&sources.some(s=>s.id===q.sourceId))return q.sourceId;
 if(sources.length===1)return sources[0].id;
 const stem=q.stem.replace(/\s/g,'');if(!stem)return undefined;
 const matches=sources.filter(s=>s.blocks.map(b=>b.text).join('\n').replace(/\s/g,'').includes(stem));
 return matches.length===1?matches[0].id:undefined;
}
export function organizationCoverageIssues(p:Project){
 return organizationScopes(p).flatMap(scope=>{const missing=missingOrganizationTargets(p,scope.targets);return missing.length?[scope.title+'：尚未整理 '+missing.map(targetLabel).join('、')]:[];});
}
