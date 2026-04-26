import { SELF, env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { jsonRequest, workerFetch } from './helpers';

async function signInTestUser(): Promise<{ email: string; cookie: string }> {
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

	return { email, cookie };
}

async function grantRole(cookie: string, role: string): Promise<string> {
	const me = await workerFetch('/api/auth/me', {
		headers: { cookie }
	});
	expect(me.status).toBe(200);
	const meJson = await me.json() as { userId?: string };
	const userId = meJson.userId || '';
	expect(userId).toBeTruthy();

	await env.AUTH_DB.prepare(
		'INSERT OR IGNORE INTO auth_user_roles (user_id, role, created_at) VALUES (?, ?, ?)'
	)
		.bind(userId, role, Date.now())
		.run();

	return userId;
}

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
		const { email, cookie } = await signInTestUser();

		const me = await workerFetch('/api/auth/me', {
			headers: { cookie }
		});
		expect(me.status).toBe(200);
		await expect(me.json()).resolves.toMatchObject({
			authenticated: true,
			email,
			roles: expect.any(Array)
		});
	});

	it('rejects developer time endpoints for non-developer users', async () => {
		const needsResponse = await workerFetch('/api/dev/time/needs');
		expect(needsResponse.status).toBe(403);

		const eventResponse = await workerFetch('/api/dev/time/event', jsonRequest({
			trackerSessionId: crypto.randomUUID(),
			eventType: 'start',
			workType: 'dev',
			needId: 'need-search-all',
			eventAt: Date.now()
		}));
		expect(eventResponse.status).toBe(403);
	});

	it('returns an error when consume token is missing', async () => {
		const response = await workerFetch('/api/auth/consume', jsonRequest({}));
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Missing sign-in token')
		});
	});

	it('saves pending verse commentary for the author and hides it from public reads', async () => {
		const { cookie } = await signInTestUser();
		const verse = `v-${crypto.randomUUID().slice(0, 8)}`;

		const saveResponse = await workerFetch('/api/verse-commentary', {
			...jsonRequest({
				book: 'GEN',
				chapter: '1',
				verse,
				entry: {
					godAndPlan: 'God begins creation.',
					examplesOfSuccess: 'Trust the Creator.',
					memoryHelps: 'Beginnings matter.',
					relatedTexts: 'John 1:1'
				}
			}),
			headers: {
				'content-type': 'application/json',
				cookie
			}
		});

		expect(saveResponse.status).toBe(200);
		await expect(saveResponse.json()).resolves.toMatchObject({
			success: true,
			status: 'pending'
		});

		const mineResponse = await workerFetch(`/api/verse-commentary?book=GEN&chapter=1&verse=${encodeURIComponent(verse)}`, {
			headers: { cookie }
		});
		expect(mineResponse.status).toBe(200);
		await expect(mineResponse.json()).resolves.toMatchObject({
			approved: null,
			mine: {
				status: 'pending',
				entry: {
					godAndPlan: 'God begins creation.',
					examplesOfSuccess: 'Trust the Creator.',
					memoryHelps: 'Beginnings matter.',
					relatedTexts: 'John 1:1'
				}
			},
			canEdit: true
		});

		const publicResponse = await workerFetch(`/api/verse-commentary?book=GEN&chapter=1&verse=${encodeURIComponent(verse)}`);
		expect(publicResponse.status).toBe(200);
		await expect(publicResponse.json()).resolves.toMatchObject({
			approved: null,
			mine: null,
			canEdit: false
		});
	});

	it('returns approved chapter markers publicly and pending markers only to the author', async () => {
		const { cookie } = await signInTestUser();
		const verse = `v-${crypto.randomUUID().slice(0, 8)}`;

		const saveResponse = await workerFetch('/api/verse-commentary', {
			...jsonRequest({
				book: 'EXO',
				chapter: '2',
				verse,
				entry: {
					godAndPlan: 'Deliverance begins.',
					examplesOfSuccess: '',
					memoryHelps: '',
					relatedTexts: ''
				}
			}),
			headers: {
				'content-type': 'application/json',
				cookie
			}
		});
		expect(saveResponse.status).toBe(200);

		const authorMarkers = await workerFetch(`/api/verse-commentary/chapter?book=EXO&chapter=2`, {
			headers: { cookie }
		});
		expect(authorMarkers.status).toBe(200);
		await expect(authorMarkers.json()).resolves.toMatchObject({
			approvedVerses: [],
			mineVerses: [verse]
		});

		const publicBeforeApproval = await workerFetch(`/api/verse-commentary/chapter?book=EXO&chapter=2`);
		expect(publicBeforeApproval.status).toBe(200);
		await expect(publicBeforeApproval.json()).resolves.toMatchObject({
			approvedVerses: [],
			mineVerses: []
		});

		await env.AUTH_DB.prepare(
			`UPDATE verse_commentary_submissions
			 SET status = 'approved', approved_at = ?, updated_at = ?
			 WHERE book = ? AND chapter = ? AND verse = ?`
		)
			.bind(Date.now(), Date.now(), 'EXO', '2', verse)
			.run();

		const publicAfterApproval = await workerFetch(`/api/verse-commentary/chapter?book=EXO&chapter=2`);
		expect(publicAfterApproval.status).toBe(200);
		await expect(publicAfterApproval.json()).resolves.toMatchObject({
			approvedVerses: [verse],
			mineVerses: []
		});
	});

	it('rejects moderation endpoints for non-moderators', async () => {
		const response = await workerFetch('/api/moderation/verse-commentary/queue');
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Moderator role required')
		});
	});

	it('lets moderators list, load, and publish pending commentary', async () => {
		const author = await signInTestUser();
		const moderator = await signInTestUser();
		await grantRole(moderator.cookie, 'moderator');
		const verse = `v-${crypto.randomUUID().slice(0, 8)}`;

		const saveResponse = await workerFetch('/api/verse-commentary', {
			...jsonRequest({
				book: 'MAT',
				chapter: '5',
				verse,
				entry: {
					godAndPlan: 'Blessed are the poor in spirit.',
					examplesOfSuccess: 'Receive God with humility.',
					memoryHelps: 'Kingdom values reverse pride.',
					relatedTexts: 'Isaiah 57:15'
				}
			}),
			headers: {
				'content-type': 'application/json',
				cookie: author.cookie
			}
		});
		expect(saveResponse.status).toBe(200);

		const queueResponse = await workerFetch('/api/moderation/verse-commentary/queue', {
			headers: { cookie: moderator.cookie }
		});
		expect(queueResponse.status).toBe(200);
		const queueJson = await queueResponse.json() as { count: number; items: Array<{ id: string; book: string; chapter: string; verse: string }> };
		expect(queueJson.count).toBeGreaterThan(0);
		const queueItem = queueJson.items.find((item) => item.book === 'MAT' && item.chapter === '5' && item.verse === verse);
		expect(queueItem).toBeTruthy();

		const itemResponse = await workerFetch(`/api/moderation/verse-commentary/item?id=${encodeURIComponent(queueItem!.id)}`, {
			headers: { cookie: moderator.cookie }
		});
		expect(itemResponse.status).toBe(200);
		await expect(itemResponse.json()).resolves.toMatchObject({
			item: {
				id: queueItem!.id,
				book: 'MAT',
				chapter: '5',
				verse,
				entry: {
					godAndPlan: 'Blessed are the poor in spirit.',
					examplesOfSuccess: 'Receive God with humility.',
					memoryHelps: 'Kingdom values reverse pride.',
					relatedTexts: 'Isaiah 57:15'
				}
			}
		});

		const publishResponse = await workerFetch('/api/moderation/verse-commentary/publish', {
			...jsonRequest({
				id: queueItem!.id,
				moderationNotes: 'Looks good. Published after light edit.',
				entry: {
					godAndPlan: 'Blessed are the poor in spirit because the kingdom begins with humble dependence.',
					examplesOfSuccess: 'Receive God with humility.',
					memoryHelps: 'Kingdom values reverse pride.',
					relatedTexts: 'Isaiah 57:15'
				}
			}),
			headers: {
				'content-type': 'application/json',
				cookie: moderator.cookie
			}
		});
		expect(publishResponse.status).toBe(200);
		await expect(publishResponse.json()).resolves.toMatchObject({
			success: true,
			item: {
				id: queueItem!.id,
				status: 'approved'
			}
		});

		const publicResponse = await workerFetch(`/api/verse-commentary?book=MAT&chapter=5&verse=${encodeURIComponent(verse)}`);
		expect(publicResponse.status).toBe(200);
		await expect(publicResponse.json()).resolves.toMatchObject({
			approved: {
				status: 'approved',
				entry: {
					godAndPlan: 'Blessed are the poor in spirit because the kingdom begins with humble dependence.',
					examplesOfSuccess: 'Receive God with humility.',
					memoryHelps: 'Kingdom values reverse pride.',
					relatedTexts: 'Isaiah 57:15'
				}
			}
		});

		const queueAfterPublish = await workerFetch('/api/moderation/verse-commentary/queue', {
			headers: { cookie: moderator.cookie }
		});
		expect(queueAfterPublish.status).toBe(200);
		const queueAfterPublishJson = await queueAfterPublish.json() as { items: Array<{ id: string }> };
		expect(queueAfterPublishJson.items.some((item) => item.id === queueItem!.id)).toBe(false);

		const moderationRow = await env.AUTH_DB.prepare(
			`SELECT moderation_notes FROM verse_commentary_submissions WHERE id = ? LIMIT 1`
		)
			.bind(queueItem!.id)
			.first<{ moderation_notes: string | null }>();
		expect(moderationRow?.moderation_notes || '').toBe('Looks good. Published after light edit.');
	});

	it('lets moderators reject pending commentary with notes', async () => {
		const author = await signInTestUser();
		const moderator = await signInTestUser();
		await grantRole(moderator.cookie, 'moderator');
		const verse = `v-${crypto.randomUUID().slice(0, 8)}`;

		const saveResponse = await workerFetch('/api/verse-commentary', {
			...jsonRequest({
				book: 'LUK',
				chapter: '6',
				verse,
				entry: {
					godAndPlan: 'Love your enemies.',
					examplesOfSuccess: '',
					memoryHelps: '',
					relatedTexts: ''
				}
			}),
			headers: {
				'content-type': 'application/json',
				cookie: author.cookie
			}
		});
		expect(saveResponse.status).toBe(200);

		const queueResponse = await workerFetch('/api/moderation/verse-commentary/queue', {
			headers: { cookie: moderator.cookie }
		});
		expect(queueResponse.status).toBe(200);
		const queueJson = await queueResponse.json() as { items: Array<{ id: string; book: string; chapter: string; verse: string }> };
		const queueItem = queueJson.items.find((item) => item.book === 'LUK' && item.chapter === '6' && item.verse === verse);
		expect(queueItem).toBeTruthy();

		const rejectResponse = await workerFetch('/api/moderation/verse-commentary/reject', {
			...jsonRequest({
				id: queueItem!.id,
				moderationNotes: 'Needs clearer examples before publication.'
			}),
			headers: {
				'content-type': 'application/json',
				cookie: moderator.cookie
			}
		});
		expect(rejectResponse.status).toBe(200);
		await expect(rejectResponse.json()).resolves.toMatchObject({
			success: true,
			item: { id: queueItem!.id, status: 'rejected' }
		});

		const queueAfterReject = await workerFetch('/api/moderation/verse-commentary/queue', {
			headers: { cookie: moderator.cookie }
		});
		expect(queueAfterReject.status).toBe(200);
		const queueAfterRejectJson = await queueAfterReject.json() as { items: Array<{ id: string }> };
		expect(queueAfterRejectJson.items.some((item) => item.id === queueItem!.id)).toBe(false);

		const row = await env.AUTH_DB.prepare(
			`SELECT status, moderation_notes FROM verse_commentary_submissions WHERE id = ? LIMIT 1`
		)
			.bind(queueItem!.id)
			.first<{ status: string; moderation_notes: string | null }>();
		expect(row?.status).toBe('rejected');
		expect(row?.moderation_notes || '').toBe('Needs clearer examples before publication.');

		const rejectedList = await workerFetch('/api/moderation/verse-commentary/rejected', {
			headers: { cookie: moderator.cookie }
		});
		expect(rejectedList.status).toBe(200);
		const rejectedJson = await rejectedList.json() as { items: Array<{ id: string; moderationNotes: string }> };
		const rejectedItem = rejectedJson.items.find((item) => item.id === queueItem!.id);
		expect(rejectedItem).toBeTruthy();
		expect(rejectedItem?.moderationNotes || '').toBe('Needs clearer examples before publication.');
	});

	it('logout is idempotent', async () => {
		const response = await workerFetch('/api/auth/logout', { method: 'POST' });
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
	});

	it('rejects suggestion submission when not signed in', async () => {
		const response = await workerFetch('/api/suggestions', jsonRequest({
			title: 'A great idea',
			description: 'Here is why.',
			categories: ['content']
		}));
		expect(response.status).toBe(401);
	});

	it('rejects suggestion when no category is provided', async () => {
		const { cookie } = await signInTestUser();
		const response = await workerFetch('/api/suggestions', {
			...jsonRequest({ title: 'A great idea', description: 'Here is why.', categories: [] }),
			headers: { 'content-type': 'application/json', cookie }
		});
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('category')
		});
	});

	it('accepts a valid suggestion and returns an id', async () => {
		const { cookie } = await signInTestUser();
		const response = await workerFetch('/api/suggestions', {
			...jsonRequest({ title: 'Translation comparison', description: 'Allow side-by-side translations.', categories: ['content'] }),
			headers: { 'content-type': 'application/json', cookie }
		});
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			id: expect.any(String)
		});
	});

	it('rejects suggestions queue for unauthenticated users', async () => {
		const response = await workerFetch('/api/moderation/suggestions/queue');
		expect(response.status).toBe(401);
	});

	it('rejects suggestions queue for users without moderator or developer role', async () => {
		const { cookie } = await signInTestUser();
		const response = await workerFetch('/api/moderation/suggestions/queue', {
			headers: { cookie }
		});
		expect(response.status).toBe(403);
	});

	it('lets moderators view the suggestions queue', async () => {
		const author = await signInTestUser();
		const moderator = await signInTestUser();
		await grantRole(moderator.cookie, 'moderator');

		const submitResponse = await workerFetch('/api/suggestions', {
			...jsonRequest({ title: 'Moderator test suggestion', description: 'Content suggestion for moderation test.', categories: ['content'] }),
			headers: { 'content-type': 'application/json', cookie: author.cookie }
		});
		expect(submitResponse.status).toBe(200);
		const { id } = await submitResponse.json() as { id: string };

		const queueResponse = await workerFetch('/api/moderation/suggestions/queue', {
			headers: { cookie: moderator.cookie }
		});
		expect(queueResponse.status).toBe(200);
		const queueJson = await queueResponse.json() as { items: Array<{ id: string; title: string; categories: string[]; authorEmail: string }> };
		const item = queueJson.items.find((i) => i.id === id);
		expect(item).toBeTruthy();
		expect(item?.title).toBe('Moderator test suggestion');
		expect(item?.categories).toContain('content');
		expect(item?.authorEmail).toBe(author.email);
	});

	it('lets developers view the suggestions queue', async () => {
		const developer = await signInTestUser();
		await grantRole(developer.cookie, 'developer');

		const submitResponse = await workerFetch('/api/suggestions', {
			...jsonRequest({ title: 'Developer test suggestion', description: 'Code suggestion for developer test.', categories: ['code'] }),
			headers: { 'content-type': 'application/json', cookie: developer.cookie }
		});
		expect(submitResponse.status).toBe(200);

		const queueResponse = await workerFetch('/api/moderation/suggestions/queue', {
			headers: { cookie: developer.cookie }
		});
		expect(queueResponse.status).toBe(200);
		const queueJson = await queueResponse.json() as { items: Array<{ id: string }> };
		expect(Array.isArray(queueJson.items)).toBe(true);
	});

	it('returns notification preferences defaulting to opted-in', async () => {
		const { cookie } = await signInTestUser();
		const response = await workerFetch('/api/notification-preferences', {
			headers: { cookie }
		});
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			notifySuggestions: true
		});
	});

	it('saves and retrieves updated notification preference', async () => {
		const { cookie } = await signInTestUser();

		const saveResponse = await workerFetch('/api/notification-preferences', {
			...jsonRequest({ notifySuggestions: false }),
			headers: { 'content-type': 'application/json', cookie }
		});
		expect(saveResponse.status).toBe(200);
		await expect(saveResponse.json()).resolves.toMatchObject({
			success: true,
			notifySuggestions: false
		});

		const getResponse = await workerFetch('/api/notification-preferences', {
			headers: { cookie }
		});
		expect(getResponse.status).toBe(200);
		await expect(getResponse.json()).resolves.toMatchObject({
			notifySuggestions: false
		});
	});
});
