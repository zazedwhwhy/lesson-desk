import type {Project} from './model';

const footer = (text:string) => /^英语.*第\s*\d+\s*页/.test(text.trim());
const transcriptStart = /^\s*\(?Text\s*1\)?(?:\s|$)/i;
const writingStart = /第一节.*应用文/;
const continuationStart = /第二节.*读后续写/;
const sectionEnd = (text:string) => /^(?:第[一二三四五]节|听力材料|听力原文|听力录音稿)/.test(text.trim()) || transcriptStart.test(text);

/** A section and its contents must come from the same uploaded document. */
export function attachSourceReferences(p:Project,multiplePapers=p.sources.filter(s=>s.role==='paper').length>1) {
 const sources=p.sources.filter(s=>s.role==='answer'||s.role==='listening');
 const note=(location:string,names:string[])=>{
  (p.sourceFidelityIssues??=[]).push({location:location+' · 来源对应关系待核对',expected:names.join('、'),received:'未自动关联，请按原卷核对。'});
 };
 const transcripts=sources.flatMap(s=>s.blocks.flatMap((block,i)=>{
  if(!transcriptStart.test(block.text))return [];
  const rest=s.blocks.slice(i+1);
  const end=rest.findIndex(b=>sectionEnd(b.text));
  return [{name:s.name,blocks:[block,...(end<0?rest:rest.slice(0,end))].filter(b=>!footer(b.text))}];
 }));
 const listening=p.passages.filter(a=>a.type==='listening');
 if(!multiplePapers && listening.length===1 && transcripts.length===1)listening[0].paragraphs=transcripts[0].blocks.map(b=>({...b}));
 else if(listening.length&&transcripts.length)note('听力原文',transcripts.map(s=>s.name));
 for(const type of ['writing','continuation'] as const){
  const targets=p.questions.filter(q=>q.type===type);
  if(!targets.length)continue;
  const marker=type==='writing'?writingStart:continuationStart;
  const candidates=sources.filter(s=>s.role==='answer').flatMap(s=>s.blocks.flatMap((block,i)=>{
   if(!marker.test(block.text))return [];
   const rest=s.blocks.slice(i+1);
   const end=rest.findIndex(b=>sectionEnd(b.text));
   const section=end<0?rest:rest.slice(0,end);
   const version=section.findIndex(b=>/one\s+possible\s+version\s*:/i.test(b.text));
   return version<0?[]:[{name:s.name,text:section.slice(version).filter(b=>!footer(b.text)).map(b=>b.text).join('\n')}];
  }));
  if(!candidates.length)continue;
  if(multiplePapers||targets.length!==1||candidates.length!==1){note(type==='writing'?'应用文范文':'续写范文',candidates.map(c=>c.name));continue;}
  targets[0].answer='参考范文（来自上传答案，非唯一答案）\n'+candidates[0].text;
  targets[0].stem=targets[0].stem.replace(/参考示例[\s\S]*$/,'').trim();
 }
 for(const a of p.passages)a.paragraphs=a.paragraphs.map(b=>({...b,text:b.text.replace(/微信公众号\s*IAI\s*English/g,'').trim()})).filter(b=>b.text&&!footer(b.text));
 return p;
}
