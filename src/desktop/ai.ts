import { connectionSettings } from '../core/ai-settings';
import { providerRequest, providerText, requestPreview } from './ai-providers';
import { restoreOptionalFields } from './openai-schema';
import {assertOcrReviewed,protectEnglish} from '../core/source-fidelity';
import {preserveFailure} from './diagnostics';
import {apiSystem as guard,analysisInstruction,organizeInstruction} from '../core/request-instructions';
import {promptBook} from './prompt-store';
import {GenerationContentError} from '../core/errors';
import{optionEntries}from'../core/options';
import{attachSourceReferences}from'../core/source-references';
import { createCitationCatalog,citation,citationParagraphs } from '../core/evidence';
import {teachingSystem}from'../core/learning';
import{ServiceStopError}from'../core/generation-model';
import { teachingSource } from '../core/logic';
import { z } from 'zod';
import { passageSchema, questionSchema, explanationSchema, uid, type Project, type Settings } from '../core/model';
const organized = z.object({ passages: z.array(z.object({ id: z.string(), title: z.string(), type: passageSchema.shape.type, paragraphs: z.array(z.object({ id: z.string(), text: z.string() })), pool: z.string() })), questions: z.array(z.object({ id: z.string(), number: z.string(), passageId: z.string(), type: questionSchema.shape.type, stem: z.string(), options: z.array(z.string()), answer: z.string() })) });
const analysisItem = z.object({questionId:z.string(),answer:z.string().min(1),analysis:z.string().min(1),evidenceIds:z.array(z.string())});
const generated = z.object({explanations:z.array(analysisItem)});
const analysisEnvelope = z.object({explanations:z.array(z.unknown())});

export async function callAI<T>(settings: Settings, key: string, schema: z.ZodType<T>, prompt: string, signal: AbortSignal, onRetry: (s: string) => void = () => { },systemPrompt=guard,images:string[]=[],maxOutputTokens=16384,outputSchema:z.ZodType=schema): Promise<T> { if (!key.trim()) throw new ServiceStopError('请先在设置中保存API Key');
    settings = { ...settings, ...connectionSettings(settings) };
    if (signal.aborted) throw Error('已取消');
    const composed = promptBook.compose(prompt, systemPrompt);
    const jsonSchema = z.toJSONSchema(outputSchema); delete (jsonSchema as any).$schema;
    const { url, headers, body } = providerRequest(settings, key, jsonSchema, composed.prompt, composed.system, images, maxOutputTokens);
    promptBook.record(composed.id, { assembledAt: new Date().toISOString(), body: requestPreview(body) });
    let rawResponse:unknown;try{for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw Error('已取消');
    const timeout = AbortSignal.timeout(120000);
    let r: Response;
    try {
        r = await fetch(url, { method: 'POST', headers, redirect: 'error', body: JSON.stringify(body), signal: AbortSignal.any([signal, timeout]) });
    }
    catch (e) {
        if (signal.aborted)
            throw Error('已取消');
        throw new ServiceStopError('请求中断、超时或接口跳转被阻止，后续任务已暂停；请检查API基础地址后手动继续，服务端可能已计费。' + String(e));
    }
    if (!r.ok) {
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
            onRetry(`服务暂不可用，正在重试 ${attempt + 1}/2`);
            await new Promise<void>((resolve, reject) => { const t = setTimeout(resolve, 1000 * 2 ** attempt); signal.addEventListener('abort', () => { clearTimeout(t); reject(Error('已取消')); }, { once: true }); });
            continue;
        }
        if([400,413,422].includes(r.status)){
            let detail:any;try{detail=await r.json();}catch(error){throw new ServiceStopError(`API请求失败（${r.status}），且错误响应无法解析；后续任务已暂停，请检查服务接口。`);}
            const code=String(detail?.error?.code||detail?.error?.type||'');
            if(/^(context_length_exceeded|max_tokens_exceeded|too_many_tokens|request_too_large)$/.test(code)&&detail?.error?.param!=='model')throw new GenerationContentError(`本项材料请求被接口拒绝（${r.status}），请检查材料长度或输出要求；其他任务继续。`);
        }
        throw new ServiceStopError(`API请求失败（${r.status}）。请检查凭据、余额、模型与服务地址；${images.length ? '本次包含图片，请确认当前模型及接口支持图片输入；' : ''}未执行项可稍后继续。`);
    }
    let data: unknown;
    try { data = await r.json(); } catch (error) {
        if (signal.aborted) throw Error('已取消');
        if (error instanceof SyntaxError || timeout.aborted) throw new ServiceStopError('API响应无法读取或不是有效JSON，后续任务已暂停，请检查服务接口');
        throw error;
    }
    rawResponse = data;
    if (signal.aborted) throw Error('已取消');
    const content = providerText(settings.provider, data);
    if (!content.trim())
        throw new GenerationContentError('AI返回空内容，本题组未生成');
    let value: unknown;
    try {
        const trimmed=content.trim(),fenced=trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
        value = JSON.parse(fenced?fenced[1]:trimmed);
    }
    catch {
        throw new GenerationContentError('AI返回无效JSON，本题组未保存');
    }
    const result = schema.safeParse(settings.provider === 'openai' ? restoreOptionalFields(value, jsonSchema) : value);
    if (!result.success)
        throw new GenerationContentError('AI内容结构不符合要求：' + result.error.issues.slice(0, 3).map(x => x.path.join('.') + ':' + x.message).join(';'));
    return result.data;
} throw new GenerationContentError('重试次数已用尽'); }catch(error){return preserveFailure(error,{stage:'api-output',task:composed.id,model:settings.model,rawResponse});} }
export async function organize(p: Project, s: Settings, key: string, signal: AbortSignal) { assertOcrReviewed(p.sources); const out = await callAI(s, key, organized, organizeInstruction+'\n材料：'+JSON.stringify(p.sources.map(s=>({id:s.id,name:s.name,role:s.role,blocks:s.blocks}))), signal,()=>{},guard,[],32768); try{const ids = new Set<string>(); for (const a of out.passages) {
    if (ids.has(a.id))
        throw Error('AI整理的材料ID重复');
    ids.add(a.id);
} const qids = new Set<string>(); for (const q of out.questions) {
    if (qids.has(q.id) || !ids.has(q.passageId))
        throw Error('AI整理的题目关联无效');
    qids.add(q.id);
} const sourceFidelityIssues:NonNullable<Project['sourceFidelityIssues']>=[]; protectEnglish(p,out,sourceFidelityIssues); const next=structuredClone(p); next.sourceFidelityIssues=sourceFidelityIssues; next.passages = out.passages.map(a => passageSchema.parse(a)); next.questions = out.questions.map(q => questionSchema.parse({ ...q, confirmed: false, excluded: false, stale: false, versions: [] })); return attachSourceReferences(next); }catch(error){return preserveFailure(error,{stage:'organize-validation',projectId:p.id,model:s.model,subject:p.subject,candidate:out});} }
export async function generateGroup(p:Project,pid:string,selected:string[],s:Settings,key:string,signal:AbortSignal,onRetry:(message:string)=>void,_legacy?:boolean,feedback=''){
 const a=p.passages.find(a=>a.id===pid),qs=p.questions.filter(q=>q.passageId===pid&&selected.includes(q.id)&&!q.excluded);if(!a||!qs.length)throw Error('没有可生成的题目');
 const catalog=createCitationCatalog(a.paragraphs),prompt=(feedback?'上次此题的校验错误如下，请针对性修正，不改参考答案：'+feedback+'\n':'')+analysisInstruction+"\n输入："+JSON.stringify({passage:{id:a.id,title:a.title,type:a.type,paragraphs:citationParagraphs(a.paragraphs,catalog),pool:a.pool},questions:qs.map(q=>({id:q.id,number:q.number,type:q.type,stem:q.stem,options:optionEntries(q.options),referenceAnswer:q.answer}))});
 // The wire schema stays strict; validate each returned row independently so one
 // malformed answer cannot discard valid siblings in a JSON-mode response.
 const out=await callAI(s,key,analysisEnvelope,prompt,signal,onRetry,teachingSystem,[],8192,generated);
 const rows=out.explanations as Array<Record<string,unknown>|null>;
 if(rows.some(e=>!e||typeof e!=='object'||!qs.some(q=>q.id===e.questionId))||new Set(rows.map(e=>e?.questionId)).size!==rows.length)throw Error('解析返回未知、缺失或重复题目ID');
 const next=structuredClone(p);
 for(const q of qs){const t=next.job.tasks?.find(t=>t.kind==='analysis'&&t.questionIds.includes(q.id)&&t.passageId===pid);try{
   const raw=rows.find(e=>e?.questionId===q.id);if(!raw)throw Error('AI遗漏本题解析');const parsed=analysisItem.safeParse(raw);if(!parsed.success)throw Error('本题缺少或写错字段：'+parsed.error.issues.map(x=>x.path.join('.')).join('、'));const e=parsed.data;if(!e.analysis.trim())throw Error('本题解析为空');const evidence=e.evidenceIds.map(id=>citation(catalog,id));
   const target=next.questions.find(x=>x.id===q.id)!,previous=!q.stale?target.versions.find(v=>v.id===target.activeVersion):undefined,old=previous?.sourceText===teachingSource(next,pid)&&previous.exercise?.kind===q.type?previous:undefined;const v=explanationSchema.parse({id:uid(),createdAt:new Date().toISOString(),origin:'ai',sourceText:teachingSource(next,pid),answer:e.answer,analysis:e.analysis,evidence,practiceBlueprint:old?.practiceBlueprint,practice:old?.practice||'',practiceAnswer:old?.practiceAnswer||'',exercise:old?.exercise,conflict:!['writing','continuation'].includes(q.type)&&!q.answer.trim().toLowerCase().split(/\s*(?:\/|;|；)\s*/).includes(e.answer.trim().toLowerCase())});target.versions.push(v);target.activeVersion=v.id;target.stale=false;
   if(t){t.state='complete';t.error='';delete next.job.errors[t.id];}
 }catch(error){if(!t)throw Error('第'+q.number+'题解析失败：'+(error instanceof Error?error.message:String(error)));t.state='failed';t.error='第'+q.number+'题：'+(error instanceof Error?error.message:String(error));next.job.errors[t.id]=t.error;}}
 return next;
}
