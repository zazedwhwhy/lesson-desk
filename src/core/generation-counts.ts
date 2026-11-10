import {z} from 'zod';
import type {Settings} from './model';
export const generationCountsSchema=z.object({sentenceCount:z.number().int().min(0).max(8),lexiconCount:z.number().int().min(0).max(20)});
export function generationCounts(settings:Settings){return generationCountsSchema.parse({sentenceCount:settings.sentenceCount??0,lexiconCount:settings.lexiconCount??0});}
export function countRequest(settings:Settings,module:string,availableSentences:number){
 const counts=generationCounts(settings),target=module==='sentences'?counts.sentenceCount:module==='lexicon'?counts.lexiconCount:0;
 return {target,limit:module==='sentences'?Math.min(target||4,availableSentences):module==='lexicon'?target||8:0,note:target?'本次优先按目标数量选取，覆盖模板中的默认数量；素材不足或不值得教学时允许少选，不能编造、重复或凑数。':'自动按教学价值筛选，素材不足不凑数。'};
}
