import type { Settings } from './model';
import { ServiceStopError } from './generation-model';

export const providerPresets = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '', protocol: 'Responses API' },
  claude: { label: 'Claude（Anthropic）', baseUrl: 'https://api.anthropic.com/v1', model: '', protocol: 'Messages API' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', protocol: 'Chat Completions API' },
  custom: { label: 'OpenAI兼容接口', baseUrl: '', model: '', protocol: 'Chat Completions API' },
} as const;

export function connectionSettings(s: Settings): Pick<Settings, 'provider' | 'model' | 'baseUrl'> {
  if (!Object.hasOwn(providerPresets, s.provider)) throw new ServiceStopError('服务商无效，请在连接设置重新选择');
  if (typeof s.model !== 'string' || !s.model.trim()) throw new ServiceStopError('请填写模型名称');
  let base: URL;
  try { base = new URL(s.baseUrl.trim()); } catch { throw new ServiceStopError('API地址格式无效，请检查模型设置'); }
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw new ServiceStopError('API地址必须使用HTTPS，本机接口可使用HTTP');
  }
  if (base.username || base.password || base.search || base.hash) throw new ServiceStopError('API地址不能包含账号、密码、查询参数或片段；请填写接口基础地址');
  if (/\/(responses|messages|chat\/completions)\/?$/.test(base.pathname)) throw new ServiceStopError('请填写API基础地址（通常以 /v1 结尾），不要包含 /responses、/messages 或 /chat/completions');
  return { provider: s.provider, model: s.model.trim(), baseUrl: base.href.replace(/\/+$/, '') };
}

export function selectProvider(s: Settings, provider: Settings['provider']): Settings {
  const preset = providerPresets[provider];
  return { ...s, provider, model: preset.model, baseUrl: preset.baseUrl, key: '', hasKey: false };
}
