import {it,expect,vi,afterEach} from 'vitest';
import {generationCounts,countRequest} from '../src/core/generation-counts';
import {generateTeachingPart} from '../src/desktop/teaching-parts';
import {demoProject} from '../src/core/demo';
import {demoGeneratedPart} from '../src/core/teaching-demo';
const settings={provider:'deepseek' as const,baseUrl:'https://api.deepseek.com',model:'test'};
afterEach(()=>vi.unstubAllGlobals());
it('默认自动，指定数量受支持范围限制',()=>{expect(generationCounts(settings)).toEqual({sentenceCount:0,lexiconCount:0});expect(countRequest({...settings,sentenceCount:8},'sentences',2).limit).toBe(2);expect(countRequest({...settings,lexiconCount:12},'lexicon',2).limit).toBe(12);expect(()=>generationCounts({...settings,lexiconCount:21})).toThrow();});
it('指定一句会进入请求材料及输出约束，拒绝返回两句',async()=>{
 const p=demoProject(),requests:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{requests.push(JSON.parse(init.body));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(demoGeneratedPart('sentences'))}}]});}));
 await expect(generateTeachingPart(p,p.passages[0].id,'sentences',[p.questions[0].id],{...settings,sentenceCount:1},'test',new AbortController().signal)).rejects.toThrow();
 expect(requests).toHaveLength(2);expect(requests[0].messages[1].content).toContain('"target":1');expect(requests[0].messages[1].content).toContain('"maxItems":1');
});
it('词汇数量可超过旧版8词上限',async()=>{
 const p=demoProject(),a=p.passages[0],terms=['gardens','parks','museums','libraries','theatres','markets','farms','schools','shops'];a.paragraphs=[{id:'b',text:'Students visit gardens, parks, museums, libraries, theatres, markets, farms, schools and shops.'}];
 const base=(demoGeneratedPart('lexicon') as any).lexicon[0],raw={lexicon:terms.map(term=>({...base,term,sourceForm:term,sourceCitationId:'C1',memoryExample:'We visit '+term+' every week.'}))};
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(JSON.parse(init.body).messages[1].content.startsWith('教学内容复核：')?{issues:[]}:raw)}}]})));
 const result=await generateTeachingPart(p,a.id,'lexicon',[p.questions[0].id],{...settings,lexiconCount:9},'test',new AbortController().signal);
 expect(result.passages[0].learning!.versions.at(-1)!.data.lexicon).toHaveLength(9);
});
