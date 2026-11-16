import type {Source,Project} from './model';
import {GenerationContentError} from './errors';

export class SourceFidelityError extends GenerationContentError{
 constructor(public location:string,public expected:string,public received:string){super('原题保真校验未通过：'+location+'；整理内容与来源不一致或有遗漏，请对照原页核对，原课件未替换');this.name='SourceFidelityError';}
}
function indexed(text:string){
 const chars:string[]=[],starts:number[]=[],ends:number[]=[];
 for(let i=0;i<text.length;i++){
  const value=text[i].normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/，/g,',').replace(/。/g,'.').replace(/；/g,';').replace(/：/g,':').replace(/[−–]/g,'-');
  for(const c of value){if(/\s/u.test(c))continue;chars.push(c);starts.push(i);ends.push(i+1);}
 }
 return {text:chars.join(''),starts,ends};
}
export function checkLiteral(source:string,value:string,location:string,{complete=false}:{complete?:boolean}={}){
 if(!value.trim()){if(complete&&source.trim())throw new SourceFidelityError(location,source,value);return '';}
 const a=indexed(source),b=indexed(value).text,at=a.text.indexOf(b);
 if(at<0||complete&&a.text!==b)throw new SourceFidelityError(location,source,value);
 return source.slice(a.starts[at],a.ends[at+b.length-1]);
}
export function pendingOcrPages(source:{ocrReviewPages?:number[];ocrVerifiedPages?:number[];warnings?:string[]}){
 const legacy=(source.warnings||[]).flatMap(w=>{const match=w.match(/^第(\d+)页经AI识别/);return match?[Number(match[1])]:[];});
 return [...new Set([...(source.ocrReviewPages||[]),...legacy])].filter(n=>!source.ocrVerifiedPages?.includes(n)).sort((a,b)=>a-b);
}
export function assertOcrReviewed(sources:{name:string;ocrReviewPages?:number[];ocrVerifiedPages?:number[];warnings?:string[]}[]){
 for(const source of sources){const pages=pendingOcrPages(source);if(pages.length)throw new GenerationContentError(source.name+'：OCR第'+pages.join('、')+'页尚未对照原页核对；转录可能改变原题错字，核对后再整理');}
}
export function reconcileOcrReview(old:Source[],next:Source[]){
 for(const source of next){const previous=old.find(s=>s.id===source.id);if(!previous)continue;
  for(const page of previous.ocrVerifiedPages||[]){const before=previous.blocks.filter(b=>b.page===page),after=source.blocks.filter(b=>b.page===page);if(JSON.stringify(before)!==JSON.stringify(after)){source.ocrVerifiedPages=(source.ocrVerifiedPages||[]).filter(n=>n!==page);source.ocrReviewPages=[...new Set([...(source.ocrReviewPages||[]),page])];}}
 }
}
export function sourceText(sources:Source[]){return sources.flatMap(s=>{
 const repeated=new Map<string,Set<number>>();
 for(const b of s.blocks)if(b.page!==undefined&&b.y!==undefined&&(b.y>760||b.y<85)){const key=b.text.replace(/\s/g,'');const pages=repeated.get(key)||new Set<number>();pages.add(b.page);repeated.set(key,pages);}
 return s.blocks.filter(b=>{
  if(b.y!==undefined&&b.y<75&&/^\d{1,3}$/.test(b.text.trim()))return false;
  if(s.kind!=='pdf'||b.y===undefined)return true;
  if(b.y<85&&/^\s*[^\n]{0,30}第\s*\d+\s*页\s*[（(]\s*共\s*\d+\s*页\s*[）)]\s*$/.test(b.text))return false;
  const header=/试题|试卷|考试|参考答案|公众号|版权所有|\b(?:exam|paper)\b|www\./i.test(b.text);
  return !(header&&(b.y>760||b.y<85)&&(repeated.get(b.text.replace(/\s/g,''))?.size||0)>1);
 }).map(b=>b.text);
}).join('\n');}
export function isExamInstruction(text:string){return /^(?:答题前|答题时|考生|本试卷|本试题卷|考试时间|请将|请在答题卡|请填写|请按如下格式|注意事项|满分|(?:写作|续写)?词数|开头和结尾已|非选择题的答案必须|可能用到的相对原子质量)/.test(text.trim());}
function withoutNumber(text:string,number:string){return text.replace(new RegExp('^\\s*'+number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[.．、]\\s*'),'');}
function withoutScore(text:string){return text.replace(/^[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]\s*/,'');}
function numberedSource(sources:Source[],number:string){
 const text=sourceText(sources),escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const start=[...text.matchAll(new RegExp('(?:^|\\n)\\s*'+escaped+'\\s*[.．、]\\s*','g'))].find(m=>!isExamInstruction(text.slice(m.index+m[0].length)));
 if(!start)return undefined;
 const tail=text.slice(start.index+start[0].length),next=/(?:^|\n)\s*\d{1,3}\s*[.．、]\s*/.exec(tail);
 const body=(next?tail.slice(0,next.index):tail).split(/\n\s*(?:非?选择题部分|[一二三四五六七八九十]+[、．]\s*(?:非?选择题|阅读理解|写作))/)[0];
 return withoutScore(body.trim());
}
export function questionSource(sources:Source[],number:string){return numberedSource(sources,number)??sourceText(sources);}
type FidelityReport = NonNullable<Project['sourceFidelityIssues']>;
export function fidelityChecker(report?:FidelityReport){
 const issue=(error:SourceFidelityError)=>{if(!report)throw error;report.push({location:error.location,expected:error.expected,received:error.received});};
 const literal=(source:string,value:string,location:string,options?:{complete?:boolean})=>{
  try{return checkLiteral(source,value,location,options);}catch(error){
   if(!(error instanceof SourceFidelityError))throw error;
   issue(error);return value; // Preserve the candidate with an explicit review report.
  }
 };
 return {literal,issue};
}
export function protectEnglish(p:Project,out:{passages:{id:string;type:string;paragraphs:{id:string;text:string}[];pool:string}[];questions:{number:string;stem:string;options:string[];answer:string;type:string;passageId:string}[]},report?:FidelityReport){
 const {literal,issue}=fidelityChecker(report);
 const paper=p.sources.filter(s=>s.role==='paper'),all=sourceText(paper),answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const a of out.passages){for(const b of a.paragraphs)b.text=literal(a.type==='listening'?sourceText(p.sources):all,b.text,a.id+'原文');if(a.pool)a.pool=literal(all,a.pool,a.id+'选项池');}
 for(const q of out.questions){
  const blank=['seven','cloze','grammar'].includes(q.type),original=questionSource(paper,q.number);
  if(blank){const number=q.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),marker=new RegExp('(?:^|[^\\d])'+number+'(?!\\d)'),passage=out.passages.find(a=>a.id===q.passageId)?.paragraphs.map(b=>b.text).join('\n')||'';if(!marker.test(passage)||q.stem.trim()&&!marker.test(q.stem))issue(new SourceFidelityError('第'+q.number+'题空号及原句',q.number,passage+'\n'+q.stem));}
  q.stem=literal(blank?all:original,q.stem,'第'+q.number+'题题干');q.options=q.options.map((o,i)=>literal(original,o,'第'+q.number+'题选项'+(i+1)));if(q.answer&&!['writing','continuation'].includes(q.type))literal(answers,q.answer,'第'+q.number+'题参考答案');
 }
}
export function protectChemistry(p:Project,out:{questions:{number:string;sourceId:string;stem:string;options:string[];answer:string}[]},report?:FidelityReport){
 const {literal,issue}=fidelityChecker(report);
 const answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const q of out.questions){
  const sources=p.sources.filter(s=>s.id===q.sourceId&&s.role==='paper'),original=numberedSource(sources,q.number);
  if(original===undefined){issue(new SourceFidelityError('第'+q.number+'题来源题号',q.number,'未找到明确题号'));continue;}
  q.stem=withoutScore(withoutNumber(q.stem,q.number));
  // Non-choice questions can contain a choice subquestion inside their stem.
  // An option repeated in the separate array must not count as missing source.
  const extraOptions=q.options.filter(option=>!indexed(q.stem).text.includes(indexed(option).text));
  literal(original,[q.stem,...extraOptions].join('\n'),'第'+q.number+'题全部作答要求',{complete:true});
  q.stem=literal(original,q.stem,'第'+q.number+'题题干');q.options=q.options.map((o,i)=>literal(original,o,'第'+q.number+'题选项'+(i+1)));
  // An explicitly numbered answer section is authoritative. Retrieve its text
  // directly, including any undecoded PDF glyphs; the model cannot rewrite it.
  const bound=p.sources.filter(s=>s.role==='answer').flatMap(s=>{const text=numberedSource([s],q.number);return text?.startsWith('【答案】')?[text.slice(4).split('【解析】')[0].trim()]:[];});
  if(bound.length===1)q.answer=bound[0];
  else if(q.answer)q.answer=literal(answers,q.answer,'第'+q.number+'题原参考答案');
 }
}
export function protectChinese(p:Project,out:{groups:{questions:{number:string;stem:string;options:string[];answer:string;answerSource:string;confirmed?:boolean}[]}[]},report?:FidelityReport){
 const {literal,issue}=fidelityChecker(report);
 const paper=p.sources.filter(s=>s.role==='paper'),answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const g of out.groups)for(const q of g.questions){const original=questionSource(paper,q.number);q.stem=literal(original,withoutNumber(q.stem,q.number),'第'+q.number+'题题干');q.options=q.options.map((o,i)=>literal(original,o,'第'+q.number+'题选项'+(i+1)));if(q.answer&&q.answerSource==='provided')q.answer=literal(answers,q.answer,'第'+q.number+'题原参考答案');q.confirmed=false;}
}
