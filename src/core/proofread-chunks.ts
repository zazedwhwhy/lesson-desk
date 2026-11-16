import {createProofreadRequest} from './proofread';
export type ProofreadInput=ReturnType<typeof createProofreadRequest>['input'];
export const PROOFREAD_CHUNK_SIZE=80000;
export type ProofreadChunk={input:ProofreadInput;fragmented:boolean};

/** Keep questions with their passages; repeat context when splitting source
 * blocks. No text is truncated. Only oversized atomic text needs fragments. */
export function splitProofreadInput(original:ProofreadInput,limit=PROOFREAD_CHUNK_SIZE):ProofreadChunk[]{
 const out:ProofreadChunk[]=[];
 function visit(input:ProofreadInput,fragmented=false){
  if(JSON.stringify(input).length<=limit){out.push({input,fragmented});return;}
  const candidates:{size:number;split:()=>ProofreadInput[]}[]=[];
  const sources=input.sources.flatMap(s=>s.blocks.map(b=>({s,b})));
  if(sources.length>1)candidates.push({size:JSON.stringify(input.sources).length,split:()=>{
   const mid=Math.ceil(sources.length/2);return [sources.slice(0,mid),sources.slice(mid)].map(rows=>{
    const next=structuredClone(input);next.sources=input.sources.filter(s=>!s.blocks.length||rows.some(r=>r.s.id===s.id)).map(s=>({...s,blocks:rows.filter(r=>r.s.id===s.id).map(r=>r.b)}));
    next.answerIndex=input.answerIndex.filter(k=>rows.some(r=>r.s.id===k.sourceId&&r.b.id===k.blockId));return next;
   });
  }});
  if(input.questions.length>1)candidates.push({size:JSON.stringify(input.questions).length+JSON.stringify(input.passages).length,split:()=>{
   const mid=Math.ceil(input.questions.length/2);return [input.questions.slice(0,mid),input.questions.slice(mid)].map(questions=>({...structuredClone(input),questions,passages:input.passages.filter(a=>questions.some(q=>q.passageId===a.id)||!input.questions.some(q=>q.passageId===a.id))}));
  }});
  // One question/source block can itself exceed the budget. Split the largest
  // textual field, keeping identity and a short overlap for boundary evidence.
  let largest:{path:(string|number)[];text:string}|undefined;
  const walk=(value:unknown,path:(string|number)[]=[])=>{
   if(typeof value==='string'&&!/id$|^title$|^name$|^type$|^role$/i.test(String(path.at(-1)))&&(!largest||value.length>largest.text.length))largest={path,text:value};
   else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))walk(item,[...path,Array.isArray(value)?Number(key):key]);
  };walk(input);
  candidates.sort((a,b)=>b.size-a.size);
  if(candidates.length&&candidates[0].size>=(largest?.text.length||0)){for(const part of candidates[0].split())visit(part,fragmented);return;}
  if(!largest||largest.text.length<1000)throw Error('校对单项结构过大，无法安全分段；原报告保留，请检查异常长的题号或选项结构');
  const {path,text}=largest;let cut=Math.floor(text.length/2);const newline=text.lastIndexOf('\n',cut);if(newline>cut/2)cut=newline+1;
  if(/[\uD800-\uDBFF]/.test(text[cut-1]||''))cut--;
  for(const part of [text.slice(0,cut+100),text.slice(Math.max(0,cut-100))]){const next=structuredClone(input);let cursor:any=next;for(const key of path.slice(0,-1))cursor=cursor[key];cursor[path.at(-1)!]=part;visit(next,true);}
 }
 visit(structuredClone(original));return out;
}
