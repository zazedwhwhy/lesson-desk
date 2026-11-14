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
export function sourceText(sources:Source[]){return sources.flatMap(s=>s.blocks.filter(b=>!(b.y!==undefined&&b.y<75&&/^\d{1,3}$/.test(b.text.trim()))).map(b=>b.text)).join('\n');}
function withoutNumber(text:string,number:string){return text.replace(new RegExp('^\\s*'+number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[.．、]\\s*'),'');}
function withoutScore(text:string){return text.replace(/^[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]\s*/,'');}
function numberedSource(sources:Source[],number:string){
 const text=sourceText(sources),escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const start=new RegExp('(?:^|\\n)\\s*'+escaped+'\\s*[.．、]\\s*').exec(text);
 if(!start)return undefined;
 const tail=text.slice(start.index+start[0].length),next=/(?:^|\n)\s*\d{1,3}\s*[.．、]\s*/.exec(tail);
 return withoutScore((next?tail.slice(0,next.index):tail).trim());
}
export function questionSource(sources:Source[],number:string){return numberedSource(sources,number)??sourceText(sources);}
export function protectEnglish(p:Project,out:{passages:{id:string;type:string;paragraphs:{id:string;text:string}[];pool:string}[];questions:{number:string;stem:string;options:string[];answer:string;type:string;passageId:string}[]}){
 const paper=p.sources.filter(s=>s.role==='paper'),all=sourceText(paper),answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const a of out.passages){for(const b of a.paragraphs)b.text=checkLiteral(a.type==='listening'?sourceText(p.sources):all,b.text,a.id+'原文');if(a.pool)a.pool=checkLiteral(all,a.pool,a.id+'选项池');}
 for(const q of out.questions){
  const blank=['seven','cloze','grammar'].includes(q.type),original=questionSource(paper,q.number);
  if(blank){const number=q.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),marker=new RegExp('(?:^|[^\\d])'+number+'(?!\\d)'),passage=out.passages.find(a=>a.id===q.passageId)?.paragraphs.map(b=>b.text).join('\n')||'';if(!marker.test(passage)||q.stem.trim()&&!marker.test(q.stem))throw new SourceFidelityError('第'+q.number+'题空号及原句',q.number,passage+'\n'+q.stem);}
  q.stem=checkLiteral(blank?all:original,q.stem,'第'+q.number+'题题干');q.options=q.options.map((o,i)=>checkLiteral(original,o,'第'+q.number+'题选项'+(i+1)));if(q.answer&&!['writing','continuation'].includes(q.type))checkLiteral(answers,q.answer,'第'+q.number+'题参考答案');
 }
}
export function protectChemistry(p:Project,out:{questions:{number:string;sourceId:string;stem:string;options:string[];answer:string}[]}){
 const answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const q of out.questions){
  const sources=p.sources.filter(s=>s.id===q.sourceId&&s.role==='paper'),original=numberedSource(sources,q.number);
  if(original===undefined)throw new SourceFidelityError('第'+q.number+'题来源题号',q.number,'未找到明确题号');
  q.stem=withoutScore(withoutNumber(q.stem,q.number));
  checkLiteral(original,[q.stem,...q.options].join('\n'),'第'+q.number+'题全部作答要求',{complete:true});
  q.stem=checkLiteral(original,q.stem,'第'+q.number+'题题干');q.options=q.options.map((o,i)=>checkLiteral(original,o,'第'+q.number+'题选项'+(i+1)));
  // An explicitly numbered answer section is authoritative. Retrieve its text
  // directly, including any undecoded PDF glyphs; the model cannot rewrite it.
  const bound=p.sources.filter(s=>s.role==='answer').flatMap(s=>{const text=numberedSource([s],q.number);return text?.startsWith('【答案】')?[text.slice(4).split('【解析】')[0].trim()]:[];});
  if(bound.length===1)q.answer=bound[0];
  else if(q.answer)q.answer=checkLiteral(answers,q.answer,'第'+q.number+'题原参考答案');
 }
}
export function protectChinese(p:Project,out:{groups:{questions:{number:string;stem:string;options:string[];answer:string;answerSource:string;confirmed?:boolean}[]}[]}){
 const paper=p.sources.filter(s=>s.role==='paper'),answers=sourceText(p.sources.filter(s=>s.role==='answer'));
 for(const g of out.groups)for(const q of g.questions){const original=questionSource(paper,q.number);q.stem=checkLiteral(original,withoutNumber(q.stem,q.number),'第'+q.number+'题题干');q.options=q.options.map((o,i)=>checkLiteral(original,o,'第'+q.number+'题选项'+(i+1)));if(q.answer&&q.answerSource==='provided')q.answer=checkLiteral(answers,q.answer,'第'+q.number+'题原参考答案');q.confirmed=false;}
}
