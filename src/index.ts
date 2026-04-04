/**
 * ServeWell.Net Worker
 * Handles static assets and dynamic endpoints for votes, suggestions, etc.
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

		// Vote endpoints
		if (url.pathname === '/api/votes' && method === 'GET') {
			return handleGetVotes(env);
		}
		if (url.pathname.startsWith('/api/vote/') && method === 'POST') {
			return handleVote(request, env, url);
		}

		// Fallback to static assets
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// ---- Vote Handlers ----

type VoteData = {
	[featureId: string]: {
		verified_up: number;
		verified_down: number;
		unverified_up: number;
		unverified_down: number;
	};
};

async function handleGetVotes(env: Env): Promise<Response> {
	try {
		const votes = await env.VOTES.get('all_votes', 'json') as VoteData | null;
		const result = votes || {};
		
		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Error getting votes:', e);
		return new Response(JSON.stringify({}), {
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleVote(request: Request, env: Env, url: URL): Promise<Response> {
	try {
		// Extract feature ID and direction from URL: /api/vote/{featureId}/{direction}
		const parts = url.pathname.split('/');
		if (parts.length < 5) {
			return new Response(JSON.stringify({ error: 'Invalid path' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const featureId = parts[3];
		const direction = parts[4]; // 'up', 'down', or 'neutral'

		if (!['up', 'down', 'neutral'].includes(direction)) {
			return new Response(JSON.stringify({ error: 'Direction must be up, down, or neutral' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get client IP for rate limiting (unverified vote tracking)
		const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
		const voteKey = `vote:${featureId}:${clientIp}`;

		// Check if user already voted on this feature
		const existingVoteStr = await env.VOTES.get(voteKey);
		let previousDirection: string | null = null;
		
		if (existingVoteStr) {
			try {
				const parsed = JSON.parse(existingVoteStr);
				previousDirection = parsed.direction;
			} catch {
				// Handle old vote format (plain '1' string from earlier code)
				previousDirection = existingVoteStr === '1' ? 'up' : null;
			}
		}

		// If voting in the same direction, reject
		if (previousDirection === direction && direction !== 'neutral') {
			return new Response(JSON.stringify({ error: 'You have already voted this way on this feature' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get current votes
		let votes = (await env.VOTES.get('all_votes', 'json') as VoteData | null) || {};

		// Initialize feature if needed
		if (!votes[featureId]) {
			votes[featureId] = { verified_up: 0, verified_down: 0, unverified_up: 0, unverified_down: 0 };
		}

		// Undo previous vote if it exists
		if (previousDirection === 'up') {
			votes[featureId].unverified_up--;
		} else if (previousDirection === 'down') {
			votes[featureId].unverified_down--;
		}

		// Apply new vote (all votes are unverified until login is implemented)
		if (direction === 'up') {
			votes[featureId].unverified_up++;
		} else if (direction === 'down') {
			votes[featureId].unverified_down++;
		}
		// if direction === 'neutral', we just removed the previous vote above

		// Record the new vote (or remove it if neutral)
		if (direction === 'neutral') {
			await env.VOTES.delete(voteKey);
		} else {
			await env.VOTES.put(voteKey, JSON.stringify({ direction, timestamp: Date.now() }), { expirationTtl: 2592000 }); // 30 days
		}

		// Save updated votes
		await env.VOTES.put('all_votes', JSON.stringify(votes));

		// Return updated vote counts
		// main = verified only (0 until logins implemented)
		// unverified = unverified net
		const main = votes[featureId].verified_up - votes[featureId].verified_down;
		const unverified = votes[featureId].unverified_up - votes[featureId].unverified_down;

		return new Response(JSON.stringify({
			success: true,
			featureId,
			direction, // Echo back the direction so client knows what was set
			votes: {
				main: main,
				unverified: unverified,
				breakdown: votes[featureId],
			},
		}), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		console.error('Error recording vote:', e);
		return new Response(JSON.stringify({ error: 'Failed to record vote' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
