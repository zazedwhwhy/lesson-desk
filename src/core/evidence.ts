import {GenerationContentError} from './errors';
type Block = { id: string; text: string };
type Reference = { blockId: string; quote: string };
export function createCitationCatalog(blocks:Block[]){
  const segmenter=new Intl.Segmenter('en',{granularity:'sentence'}),catalog:{id:string;blockId:string;quote:string}[]=[];
  for(const b of blocks)for(const part of segmenter.segment(b.text.replace(/\s/g,' '))){const quote=b.text.slice(part.index,part.index+part.segment.length).trim();if(quote)catalog.push({id:'C'+(catalog.length+1),blockId:b.id,quote});}
  return catalog;
}
export function citation(catalog:ReturnType<typeof createCitationCatalog>,id:string){const ref=catalog.find(r=>r.id===id);if(!ref)throw new EvidenceValidationError('引用了未知的原句编号 '+id);return{blockId:ref.blockId,quote:ref.quote};}
export function citationParagraphs(blocks:Block[],catalog:ReturnType<typeof createCitationCatalog>){return blocks.map(b=>({id:b.id,sentences:catalog.filter(c=>c.blockId===b.id).map(c=>({id:c.id,text:c.quote}))}));}
export const completeSentenceIds=(catalog:ReturnType<typeof createCitationCatalog>)=>catalog.filter(c=>!/_|\[\d+\]/.test(c.quote)&&(c.quote.match(/[a-z]{2,}/gi)||[]).length>=3).map(c=>c.id);

export class EvidenceValidationError extends GenerationContentError {
  constructor(message: string) { super(message); this.name = 'EvidenceValidationError'; }
}

// Keep offsets into the source: accepted typography differences must still
// produce a literal source substring for display and highlighting.
function normalized(text: string) {
  const chars: string[] = [], starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (/\s/u.test(char)) char = ' ';
    else if (/[‘’]/u.test(char)) char = "'";
    else if (/[“”]/u.test(char)) char = '"';
    if (char === ' ' && (!chars.length || chars.at(-1) === ' ')) {
      if (chars.length) ends[ends.length - 1] = i + 1;
      continue;
    }
    chars.push(char); starts.push(i); ends.push(i + 1);
  }
  if (chars.at(-1) === ' ') { chars.pop(); starts.pop(); ends.pop(); }
  return { text: chars.join(''), starts, ends };
}

export function resolveEvidence(blocks: Block[], ref: Reference): Reference {
  if (!ref.quote.trim()) throw new EvidenceValidationError('引用为空');
  const block = blocks.find(b => b.id === ref.blockId);
  if (!block) throw new EvidenceValidationError(`段落编号 ${ref.blockId} 不存在`);
  if (block.text.includes(ref.quote)) return { ...ref };
  const source = normalized(block.text), target = normalized(ref.quote).text;
  const at = source.text.indexOf(target);
  if (at < 0) throw new EvidenceValidationError('引用文字与该段原文不一致（不能填入空位答案、改写或省略原句）');
  if (source.text.indexOf(target, at + 1) !== -1)
    throw new EvidenceValidationError('引用在原段落中多处出现，请引用更完整的原句');
  return { blockId: block.id, quote: block.text.slice(source.starts[at], source.ends[at + target.length - 1]) };
}
