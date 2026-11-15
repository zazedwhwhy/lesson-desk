import type { Settings } from '../core/model';
import { GenerationContentError } from '../core/errors';
import { ServiceStopError } from '../core/generation-model';
import { openaiSchema } from './openai-schema';

function claudeImage(image: string) {
  const match = image.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/);
  if (!match || !match[2]) throw new GenerationContentError('Claude 图片必须为有效的 PNG、JPEG、GIF 或 WebP base64 数据，请重新导入图片');
  return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
}

export function providerRequest(s: Settings, key: string, schema: object, prompt: string, system: string, images: string[], maxTokens: number): { url: string; headers: Record<string, string>; body: object } {
  const base = s.baseUrl.replace(/\/+$/, '');
  const userText = prompt + '\n输出必须为json，不要添加说明或Markdown代码围栏。结构：' + JSON.stringify(schema);
  if (s.provider === 'openai') return {
    url: base + '/responses', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: { model: s.model, max_output_tokens: maxTokens, input: [
      { role: 'system', content: system },
      { role: 'user', content: images.length ? [{ type: 'input_text', text: prompt }, ...images.map(image_url => ({ type: 'input_image', image_url, detail: 'auto' }))] : prompt },
    ], text: { format: { type: 'json_schema', name: 'lesson_content', strict: true, schema: openaiSchema(schema) } } },
  };
  if (s.provider === 'claude') return {
    url: base + '/messages', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: { model: s.model, max_tokens: maxTokens, system, messages: [
      { role: 'user', content: [{ type: 'text', text: userText }, ...images.map(claudeImage)] },
    ] },
  };
  return {
    url: base + '/chat/completions', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: { model: s.model, max_tokens: maxTokens, messages: [
      { role: 'system', content: system },
      { role: 'user', content: images.length ? [{ type: 'text', text: userText }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] : userText },
    ], ...(s.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}), response_format: { type: 'json_object' } },
  };
}

export function requestPreview(body: unknown) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (['url', 'image_url', 'data'].includes(key) && typeof value === 'string' && (key === 'data' || value.startsWith('data:'))) return '[图片内容，预览省略]';
    return value;
  }));
}

// HTTP success alone does not establish a completed generation.
export function providerText(provider: Settings['provider'], data: any): string {
  if (!data || typeof data !== 'object') throw new ServiceStopError('API响应格式无效，请检查服务接口');
  let content: unknown;
  if (provider === 'openai') {
    if (data.status === 'incomplete') throw new GenerationContentError('AI输出被截断，请缩小题组后重试');
    if (data.status !== 'completed' || data.error) throw new ServiceStopError('OpenAI响应未完整结束或失败，后续任务已暂停，请检查服务状态');
    if (!Array.isArray(data.output)) throw new ServiceStopError('OpenAI响应缺少output，请检查是否选择了正确的API协议');
    const parts = data.output.flatMap((x: any) => Array.isArray(x?.content) ? x.content : []);
    if (parts.some((x: any) => x?.type === 'refusal')) throw new GenerationContentError('模型拒绝生成本次内容');
    const texts = parts.filter((x: any) => x?.type === 'output_text');
    if (texts.some((x: any) => typeof x.text !== 'string')) throw new ServiceStopError('OpenAI响应文本格式无效');
    content = texts.map((x: any) => x.text).join('');
  } else if (provider === 'claude') {
    if (data.stop_reason === 'max_tokens') throw new GenerationContentError('AI输出被截断，请缩小题组后重试');
    if (data.stop_reason === 'refusal') throw new GenerationContentError('模型拒绝生成本次内容');
    if (data.stop_reason !== 'end_turn') throw new GenerationContentError('Claude输出未完整结束，本次结果未保存，请重试');
    if (!Array.isArray(data.content)) throw new ServiceStopError('Claude响应缺少content，请检查是否选择了Messages API');
    const texts = data.content.filter((x: any) => x?.type === 'text');
    if (texts.some((x: any) => typeof x.text !== 'string')) throw new ServiceStopError('Claude响应文本格式无效');
    content = texts.map((x: any) => x.text).join('');
  } else {
    if (data.choices?.[0]?.finish_reason !== 'stop') throw new GenerationContentError(data.choices?.[0]?.finish_reason === 'length' ? '生成内容达到输出长度上限，请缩小题组后重试' : 'AI输出未完整结束，请重试');
    content = data.choices?.[0]?.message?.content;
  }
  if (content == null || content === '') throw new GenerationContentError('AI返回空内容，本题组未生成');
  if (typeof content !== 'string') throw new ServiceStopError('API响应文本格式无效，请检查服务接口');
  return content;
}
