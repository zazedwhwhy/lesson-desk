import { expect, it } from 'vitest';
import { connectionSettings, selectProvider } from '../src/core/ai-settings';
import type { Settings } from '../src/core/model';
const s: Settings = { provider: 'openai', baseUrl: 'https://api.openai.com/v1/', model: ' chosen-model ', hasKey: true, key: 'synthetic-key', sentenceCount: 3 };
it('切换 Claude 使用原生地址且清除旧服务的密钥和保存标记', () => {
  expect(selectProvider(s, 'claude')).toEqual({ provider: 'claude', baseUrl: 'https://api.anthropic.com/v1', model: '', key: '', hasKey: false, sentenceCount: 3 });
});
it('验证并规范化连接设置但不切换模型或服务', () => {
  expect(connectionSettings(s)).toEqual({ provider: 'openai', model: 'chosen-model', baseUrl: 'https://api.openai.com/v1' });
});
it.each(['http://remote.example/v1', 'https://user:pass@example.com/v1', 'https://example.com/v1?key=synthetic', 'https://example.com/v1#api', 'https://example.com/v1/messages', 'https://example.com/v1/responses', 'https://example.com/v1/chat/completions', 'broken'])('拒绝错误地址 %s', baseUrl => {
  expect(() => connectionSettings({ ...s, baseUrl })).toThrow();
});
it('允许本机模拟接口和代理的自定义基础路径', () => {
  expect(connectionSettings({ ...s, baseUrl: 'http://127.0.0.1:8090/proxy/v1/' }).baseUrl).toBe('http://127.0.0.1:8090/proxy/v1');
});
