import {GenerationContentError} from './errors';
import {z} from 'zod';
import {teachingCoreSchema,vocabularyRecall,type Teaching} from './learning';
import {citation,type createCitationCatalog} from './evidence';

const specific=z.string().trim().min(1);
const citationIds=z.array(specific).min(1).max(4);
export const structureGenerationSchema=teachingCoreSchema.shape.structure.extend({
 outline:z.array(teachingCoreSchema.shape.structure.shape.outline.element.omit({evidence:true}).extend({relation:specific,evidenceCitationIds:citationIds})).min(1),
 questionLinks:z.array(z.object({questionId:specific,citationIds,focus:specific,method:specific}))
});
export const lexiconGenerationSchema=z.array(teachingCoreSchema.shape.lexicon.element.extend({
 sourceForm:specific,partOfSpeech:specific,usageNote:specific,exampleTranslation:specific
})).min(1).max(20);

type Catalog=ReturnType<typeof createCitationCatalog>;
type Paragraph={id:string;text:string};
type Question={id:string;number:string};

export function bindStructure(raw:z.infer<typeof structureGenerationSchema>,catalog:Catalog,paragraphs:Paragraph[],questions:Question[]):Teaching['structure']{
 let previousEnd=0;
 const outline=raw.outline.map(({evidenceCitationIds,...part})=>{
  if(part.paragraph<=previousEnd||part.endParagraph<part.paragraph||part.endParagraph>paragraphs.length)throw new GenerationContentError('篇章板块的段落范围必须有效、按原文顺序且不重叠');
  previousEnd=part.endParagraph;
  const blocks=new Set(paragraphs.slice(part.paragraph-1,part.endParagraph).map(p=>p.id));
  const evidence=[...new Set(evidenceCitationIds)].map(id=>citation(catalog,id));
  if(evidence.some(e=>!blocks.has(e.blockId)))throw new GenerationContentError('篇章板块的证据超出本板块段落范围');
  return {...part,evidence};
 });
 const seen=new Set<string>();
 const questionLinks=raw.questionLinks.map(({questionId,citationIds,focus,method})=>{
  const q=questions.find(q=>q.id===questionId);
  if(!q||seen.has(questionId))throw new GenerationContentError('篇章考点关联了未知或重复的题目');
  seen.add(questionId);
  return {questionId,questionNumber:q.number,focus,method,evidence:[...new Set(citationIds)].map(id=>citation(catalog,id))};
 });
 if(questions.some(q=>!seen.has(q.id)))throw new GenerationContentError('篇章考点遗漏了本次选择的题目');
 return {...raw,outline,questionLinks};
}

export function bindLexicon(raw:z.infer<typeof lexiconGenerationSchema>,catalog:Catalog):Teaching['lexicon']{
 const seen=new Set<string>();
 return raw.map(w=>{
  const sourceQuote=citation(catalog,w.sourceCitationId).quote;
  const pattern=new RegExp('(?<![A-Za-z])'+w.sourceForm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'(?![A-Za-z])','i');
  const match=sourceQuote.match(pattern);
  if(!match||!/[a-z]/i.test(w.sourceForm)||/[\u3400-\u9fff]/u.test(w.sourceForm))throw new GenerationContentError('词条 '+w.term+' 的原文形态不在所引原句中：'+w.sourceForm);
  const key=w.term.toLowerCase().replace(/\s+/g,' ').trim();
  if(seen.has(key))throw new GenerationContentError('词汇手账包含重复词条：'+w.term);
  seen.add(key);
  const sourceForm=match[0];
  return {...w,sourceForm,sourceQuote,memory:'',...vocabularyRecall(w.term,sourceQuote,w.meaning,w.collocations,sourceForm)};
 });
}
