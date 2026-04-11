import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src';

export async function workerFetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request<unknown, IncomingRequestCfProperties>(
    `http://localhost${path}`,
    init
  );
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function jsonRequest(body: Record<string, unknown>): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}
