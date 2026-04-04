import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('servewell worker', () => {
	it('returns vote totals as JSON', async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/votes');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual(expect.any(Object));
	});

	it('records anonymous votes as unverified', async () => {
		const featureId = `test-${crypto.randomUUID()}`;
		const request = new Request<unknown, IncomingRequestCfProperties>(
			`http://example.com/api/vote/${featureId}/up`,
			{
				method: 'POST',
				headers: { 'cf-connecting-ip': '203.0.113.10' }
			}
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			featureId,
			vote_scope: 'unverified',
			votes: {
				main: 0,
				unverified: 1,
				breakdown: {
					verified_up: 0,
					verified_down: 0,
					unverified_up: 1,
					unverified_down: 0
				}
			}
		});
	});

	it('reports signed-out auth state when auth is not configured', async () => {
		const response = await SELF.fetch('http://example.com/api/auth/me');

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ authenticated: false });
	});
});
