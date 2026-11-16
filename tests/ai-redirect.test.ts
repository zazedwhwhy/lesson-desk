import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { callAI } from '../src/desktop/ai';
import { ServiceStopError } from '../src/core/generation-model';

async function listen(server: Server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const close = (server: Server) => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

it('Claude 原生 fetch 遇到跨源307时停止，不向跳转目标发送密钥或材料', async () => {
  let targetRequests = 0;
  const target = createServer((_req, res) => { targetRequests++; res.end('{}'); });
  const targetUrl = await listen(target);
  const source = createServer((_req, res) => { res.writeHead(307, { Location: targetUrl + '/messages' }); res.end(); });
  try {
    const baseUrl = await listen(source);
    await expect(callAI({ provider: 'claude', model: 'synthetic-model', baseUrl }, 'synthetic-key', z.object({ ok: z.boolean() }), '合成材料', new AbortController().signal)).rejects.toBeInstanceOf(ServiceStopError);
    expect(targetRequests).toBe(0);
  } finally { await Promise.all([close(source), close(target)]); }
});
