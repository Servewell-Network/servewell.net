import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { jsonRequest, workerFetch } from './helpers';

describe('servewell worker', () => {
	it('returns vote totals as JSON', async () => {
		const response = await workerFetch('/api/votes');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual(expect.any(Object));
	});

	it('records anonymous votes as unverified', async () => {
		const featureId = `test-${crypto.randomUUID()}`;
		const response = await workerFetch(`/api/vote/${featureId}/up`, {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.10' }
		});

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

	it('rejects duplicate vote in same direction for same feature and IP', async () => {
		const featureId = `dup-${crypto.randomUUID()}`;

		const first = await workerFetch(`/api/vote/${featureId}/up`, {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.11' }
		});
		expect(first.status).toBe(200);

		const second = await workerFetch(`/api/vote/${featureId}/up`, {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.11' }
		});
		expect(second.status).toBe(400);
		await expect(second.json()).resolves.toMatchObject({
			error: expect.stringContaining('already voted')
		});
	});

	it('removes a vote when neutral is submitted', async () => {
		const featureId = `neutral-${crypto.randomUUID()}`;
		const headers = { 'cf-connecting-ip': '203.0.113.12' };

		const first = await workerFetch(`/api/vote/${featureId}/up`, { method: 'POST', headers });
		expect(first.status).toBe(200);

		const neutral = await workerFetch(`/api/vote/${featureId}/neutral`, { method: 'POST', headers });
		expect(neutral.status).toBe(200);

		await expect(neutral.json()).resolves.toMatchObject({
			success: true,
			featureId,
			direction: 'neutral',
			votes: {
				unverified: 0,
				breakdown: {
					unverified_up: 0,
					unverified_down: 0
				}
			}
		});
	});

	it('records downvotes in unverified_down bucket', async () => {
		const featureId = `down-${crypto.randomUUID()}`;
		const response = await workerFetch(`/api/vote/${featureId}/down`, {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.13' }
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			featureId,
			votes: {
				unverified: -1,
				breakdown: {
					unverified_up: 0,
					unverified_down: 1
				}
			}
		});
	});

	it('rejects invalid vote direction', async () => {
		const response = await workerFetch('/api/vote/need-test/sideways', {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.14' }
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Direction must')
		});
	});

	it('returns 404 for unknown routes', async () => {
		const response = await workerFetch('/api/this-route-does-not-exist');
		expect(response.status).toBe(404);
	});

	it('reports signed-out auth state when auth is not configured', async () => {
		const response = await SELF.fetch('http://example.com/api/auth/me');

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ authenticated: false });
	});

	it('rejects invalid email in request-link endpoint', async () => {
		const response = await workerFetch('/api/auth/request-link', jsonRequest({ email: 'not-an-email' }));
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('valid email')
		});
	});

	it('provides dev magic link locally and authenticates session', async () => {
		const email = `dev-${crypto.randomUUID()}@example.com`;

		const requestLink = await workerFetch('/api/auth/request-link', jsonRequest({ email }));
		expect(requestLink.status).toBe(200);
		const requestJson = await requestLink.json() as { dev_magic_link?: string; success?: boolean };
		expect(requestJson.success).toBe(true);
		expect(typeof requestJson.dev_magic_link).toBe('string');

		const magicLink = new URL(requestJson.dev_magic_link || 'http://localhost/auth/verify?token=');
		const token = magicLink.searchParams.get('token');
		expect(token).toBeTruthy();

		const consume = await workerFetch('/api/auth/consume', jsonRequest({ token }));
		expect(consume.status).toBe(200);
		const cookie = consume.headers.get('set-cookie') || '';
		expect(cookie).toContain('servewell_session=');

		const me = await workerFetch('/api/auth/me', {
			headers: { cookie }
		});
		expect(me.status).toBe(200);
		await expect(me.json()).resolves.toMatchObject({
			authenticated: true,
			email
		});
	});

	it('returns an error when consume token is missing', async () => {
		const response = await workerFetch('/api/auth/consume', jsonRequest({}));
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Missing sign-in token')
		});
	});

	it('logout is idempotent', async () => {
		const response = await workerFetch('/api/auth/logout', { method: 'POST' });
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
	});
});
