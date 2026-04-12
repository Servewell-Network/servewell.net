/**
 * ServeWell.Net Worker
 * Handles static assets and dynamic endpoints for votes and authentication.
 */

import featureInventory from './shared/feature-inventory.json';

type AuthDbEnv = Env & {
	AUTH_DB?: D1Database;
	AUTH_ORIGIN?: string;
	AUTH_FROM_EMAIL?: string;
	AUTH_DEVELOPER_EMAILS?: string;
	RESEND_API_KEY?: string;
};

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'servewell_session';

const TABLES_SQL = [
	`CREATE TABLE IF NOT EXISTS auth_users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth_magic_links (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL,
		token_hash TEXT NOT NULL UNIQUE,
		created_at INTEGER NOT NULL,
		expires_at INTEGER NOT NULL,
		used_at INTEGER,
		requested_ip TEXT,
		requested_user_agent TEXT,
		consumed_ip TEXT,
		consumed_user_agent TEXT
	)`,
	`CREATE INDEX IF NOT EXISTS idx_auth_magic_links_email_created ON auth_magic_links(email, created_at)`,
	`CREATE TABLE IF NOT EXISTS auth_sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		session_hash TEXT NOT NULL UNIQUE,
		created_at INTEGER NOT NULL,
		last_seen_at INTEGER NOT NULL,
		expires_at INTEGER NOT NULL,
		absolute_expires_at INTEGER NOT NULL,
		revoked_at INTEGER,
		created_ip TEXT,
		created_user_agent TEXT,
		FOREIGN KEY (user_id) REFERENCES auth_users(id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)`,
	`CREATE TABLE IF NOT EXISTS auth_user_roles (
		user_id TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, role),
		FOREIGN KEY (user_id) REFERENCES auth_users(id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role ON auth_user_roles(role)`,
	`CREATE TABLE IF NOT EXISTS dev_time_events (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		tracker_session_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		work_type TEXT NOT NULL,
		need_id TEXT NOT NULL,
		event_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		FOREIGN KEY (user_id) REFERENCES auth_users(id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_time_events_user_created ON dev_time_events(user_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS dev_time_entries (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		tracker_session_id TEXT NOT NULL,
		work_type TEXT NOT NULL,
		need_id TEXT NOT NULL,
		start_time INTEGER NOT NULL,
		end_time INTEGER NOT NULL,
		duration_minutes INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		FOREIGN KEY (user_id) REFERENCES auth_users(id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_time_entries_user_created ON dev_time_entries(user_id, created_at)`
];

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

		if (url.pathname === '/api/auth/request-link' && method === 'POST') {
			return handleRequestMagicLink(request, env as AuthDbEnv, url);
		}
		if (url.pathname === '/auth/verify' && method === 'GET') {
			return handleVerifyPage(request, env as AuthDbEnv, url);
		}
		if (url.pathname === '/api/auth/consume' && method === 'POST') {
			return handleConsumeMagicLink(request, env as AuthDbEnv, url);
		}
		if (url.pathname === '/api/auth/logout' && method === 'POST') {
			return handleLogout(request, env as AuthDbEnv);
		}
		if (url.pathname === '/api/auth/me' && method === 'GET') {
			return handleAuthMe(request, env as AuthDbEnv);
		}
		if (url.pathname === '/api/dev/time/needs' && method === 'GET') {
			return handleDevTimeNeeds(request, env as AuthDbEnv);
		}
		if (url.pathname === '/api/dev/time/event' && method === 'POST') {
			return handleDevTimeEvent(request, env as AuthDbEnv);
		}
		if (url.pathname === '/api/dev/time/save' && method === 'POST') {
			return handleDevTimeSave(request, env as AuthDbEnv);
		}
		if (url.pathname === '/api/dev/time/summary' && method === 'GET') {
			return handleDevTimeSummary(request, env as AuthDbEnv, url);
		}

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

type AuthUser = {
	id: string;
	email: string;
};

type AuthSession = {
	id: string;
	user_id: string;
	session_hash: string;
	created_at: number;
	last_seen_at: number;
	expires_at: number;
	absolute_expires_at: number;
	revoked_at: number | null;
};

async function handleRequestMagicLink(request: Request, env: AuthDbEnv, url: URL): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) {
		return jsonResponse({ error: 'Auth database is not configured' }, 503);
	}

	await ensureAuthTables(db);

	const body = await parseBody(request);
	const rawEmail = typeof body.email === 'string' ? body.email : '';
	const email = normalizeEmail(rawEmail);
	if (!isValidEmail(email)) {
		return jsonResponse({ error: 'Please provide a valid email address' }, 400);
	}

	const now = Date.now();
	const recentCountRow = await db
		.prepare('SELECT COUNT(*) AS c FROM auth_magic_links WHERE email = ? AND created_at > ?')
		.bind(email, now - 15 * 60 * 1000)
		.first<{ c: number }>();
	const recentCount = Number(recentCountRow?.c || 0);
	if (recentCount >= 5) {
		return jsonResponse({ error: 'Too many login requests. Please wait and try again.' }, 429);
	}

	const token = randomToken(32);
	const tokenHash = await sha256Base64Url(token);
	const tokenId = crypto.randomUUID();
	const expiresAt = now + MAGIC_LINK_TTL_MS;
	const requestedIp = getClientIp(request);
	const requestedUserAgent = request.headers.get('user-agent') || null;

	await db
		.prepare(
			`INSERT INTO auth_magic_links
				(id, email, token_hash, created_at, expires_at, requested_ip, requested_user_agent)
				VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(tokenId, email, tokenHash, now, expiresAt, requestedIp, requestedUserAgent)
		.run();

	const magicLink = `${getAuthOrigin(url, env)}/auth/verify?token=${encodeURIComponent(token)}`;
	const emailResult = await sendMagicLinkEmail(request, env, email, magicLink);

	if (!emailResult.ok) {
		await db.prepare('DELETE FROM auth_magic_links WHERE id = ?').bind(tokenId).run();
		return jsonResponse({ error: emailResult.error }, 503);
	}

	const responsePayload: Record<string, unknown> = {
		success: true,
		message: 'Check your email for a sign-in link.'
	};
	if (emailResult.devLink) {
		responsePayload.dev_magic_link = emailResult.devLink;
	}

	return jsonResponse(responsePayload, 200);
}

async function handleVerifyPage(request: Request, env: AuthDbEnv, url: URL): Promise<Response> {
	const token = url.searchParams.get('token') || '';
	const safeToken = escapeHtml(token);
	const hasToken = token.length > 10;

	const html = [
		'<!doctype html>',
		'<html lang="en">',
		'<head>',
		'  <meta charset="utf-8">',
		'  <meta name="viewport" content="width=device-width, initial-scale=1">',
		'  <title>Verify Sign-In | ServeWell.Net</title>',
		'  <style>',
		'    body { font-family: sans-serif; margin: 2rem; line-height: 1.45; }',
		'    main { max-width: 42rem; margin: 0 auto; }',
		'    .card { border: 1px solid #d9d9de; border-radius: 10px; padding: 1rem 1.2rem; }',
		'    button { font: inherit; padding: 0.55rem 0.9rem; border-radius: 8px; border: 1px solid #d9d9de; cursor: pointer; }',
		'    code { word-break: break-all; }',
		'  </style>',
		'</head>',
		'<body>',
		'  <main>',
		'    <h1>Sign In</h1>',
		'    <div class="card">',
		hasToken
			? '      <p>Click continue to finish signing in.</p>'
			: '      <p>This sign-in link is missing a token. Please request a new link.</p>',
		hasToken
			? [
				'      <form method="post" action="/api/auth/consume">',
				`        <input type="hidden" name="token" value="${safeToken}">`,
				'        <button type="submit">Continue</button>',
				'      </form>'
			].join('\n')
			: '',
		'    </div>',
		'  </main>',
		'</body>',
		'</html>'
	].join('\n');

	return new Response(html, {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

async function handleConsumeMagicLink(request: Request, env: AuthDbEnv, url: URL): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) {
		return jsonResponse({ error: 'Auth database is not configured' }, 503);
	}

	await ensureAuthTables(db);

	const body = await parseBody(request);
	const token = typeof body.token === 'string' ? body.token.trim() : '';
	if (!token) {
		return respondConsumeFailure(request, 'Missing sign-in token', 400);
	}

	const tokenHash = await sha256Base64Url(token);
	const now = Date.now();
	const tokenRow = await db
		.prepare(
			`SELECT id, email, expires_at, used_at
			 FROM auth_magic_links
			 WHERE token_hash = ?
			 LIMIT 1`
		)
		.bind(tokenHash)
		.first<{ id: string; email: string; expires_at: number; used_at: number | null }>();

	if (!tokenRow || tokenRow.used_at || tokenRow.expires_at < now) {
		return respondConsumeFailure(request, 'That sign-in link is invalid or expired. Please request a new one.', 400);
	}

	await db
		.prepare('UPDATE auth_magic_links SET used_at = ?, consumed_ip = ?, consumed_user_agent = ? WHERE id = ? AND used_at IS NULL')
		.bind(now, getClientIp(request), request.headers.get('user-agent') || null, tokenRow.id)
		.run();

	let user = await db
		.prepare('SELECT id, email FROM auth_users WHERE email = ? LIMIT 1')
		.bind(tokenRow.email)
		.first<AuthUser>();

	if (!user) {
		const userId = crypto.randomUUID();
		await db.prepare('INSERT INTO auth_users (id, email, created_at) VALUES (?, ?, ?)').bind(userId, tokenRow.email, now).run();
		user = { id: userId, email: tokenRow.email };
	}

	const sessionToken = randomToken(32);
	const sessionHash = await sha256Base64Url(sessionToken);
	const sessionId = crypto.randomUUID();
	const expiresAt = now + SESSION_IDLE_MS;
	const absoluteExpiresAt = now + SESSION_ABSOLUTE_MS;

	await db
		.prepare(
			`INSERT INTO auth_sessions
				(id, user_id, session_hash, created_at, last_seen_at, expires_at, absolute_expires_at, created_ip, created_user_agent)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			sessionId,
			user.id,
			sessionHash,
			now,
			now,
			expiresAt,
			absoluteExpiresAt,
			getClientIp(request),
			request.headers.get('user-agent') || null
		)
		.run();

	const cookie = buildSessionCookie(sessionToken);

	if (isFormRequest(request)) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: '/',
				'Set-Cookie': cookie
			}
		});
	}

	return jsonResponse({ success: true, email: user.email }, 200, { 'Set-Cookie': cookie });
}

async function handleLogout(request: Request, env: AuthDbEnv): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) {
		return jsonResponse({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
	}

	await ensureAuthTables(db);
	const sessionToken = readSessionCookie(request);
	if (sessionToken) {
		const sessionHash = await sha256Base64Url(sessionToken);
		await db
			.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL')
			.bind(Date.now(), sessionHash)
			.run();
	}

	return jsonResponse({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

async function handleAuthMe(request: Request, env: AuthDbEnv): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) {
		return jsonResponse({ authenticated: false });
	}
	await ensureAuthTables(db);
	const auth = await requireAuthUser(request, env);
	if (!auth) {
		return jsonResponse({ authenticated: false });
	}
	const roles = await getUserRoles(db, auth.id);
	return jsonResponse({ authenticated: true, userId: auth.id, email: auth.email, roles });
}

function normalizeRole(value: string): string {
	return value.trim().toLowerCase();
}

function getConfiguredDeveloperEmails(env: AuthDbEnv): Set<string> {
	const raw = (env.AUTH_DEVELOPER_EMAILS || '').trim();
	if (!raw) return new Set();
	return new Set(
		raw
			.split(/[\s,;]+/)
			.map((part) => normalizeEmail(part))
			.filter(Boolean)
	);
}

async function ensureConfiguredDeveloperRole(db: D1Database, env: AuthDbEnv, user: AuthUser): Promise<void> {
	const emails = getConfiguredDeveloperEmails(env);
	if (!emails.has(user.email)) return;
	await db
		.prepare('INSERT OR IGNORE INTO auth_user_roles (user_id, role, created_at) VALUES (?, ?, ?)')
		.bind(user.id, 'developer', Date.now())
		.run();
}

async function getUserRoles(db: D1Database, userId: string): Promise<string[]> {
	const rows = await db
		.prepare('SELECT role FROM auth_user_roles WHERE user_id = ? ORDER BY role ASC')
		.bind(userId)
		.all<{ role: string }>();
	const rawRows = rows.results || [];
	return rawRows.map((row) => normalizeRole(row.role)).filter(Boolean);
}

async function requireDeveloperAuth(request: Request, env: AuthDbEnv): Promise<{ user: AuthUser; roles: string[] } | null> {
	const db = env.AUTH_DB;
	if (!db) return null;
	await ensureAuthTables(db);
	const user = await requireAuthUser(request, env);
	if (!user) return null;
	await ensureConfiguredDeveloperRole(db, env, user);
	const roles = await getUserRoles(db, user.id);
	if (!roles.includes('developer')) return null;
	return { user, roles };
}

function isValidWorkType(value: string): value is 'dev' | 'adm' | 'copy' {
	return value === 'dev' || value === 'adm' || value === 'copy';
}

function isValidEventType(value: string): value is 'start' | 'pause' | 'stop' {
	return value === 'start' || value === 'pause' || value === 'stop';
}

function sanitizeNeedId(value: unknown): string {
	const raw = typeof value === 'string' ? value.trim() : '';
	if (!raw) return '';
	if (!/^need-[a-z0-9-]+$/.test(raw)) return '';
	return raw;
}

// Empty string is an acceptable needId (means "no specific need selected")

type DevTimeNeed = { id: string; label: string };

function toNeedLabel(id: string): string {
	const compact = id.replace(/^need-/, '').replace(/-/g, ' ').trim();
	if (!compact) return id;
	return compact
		.split(/\s+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function getAllNeedOptions(): DevTimeNeed[] {
	const source = Array.isArray((featureInventory as any).allNeedIds) ? (featureInventory as any).allNeedIds as string[] : [];
	const ids = source.filter((id) => /^need-[a-z0-9-]+$/.test(id));
	return ids.map((id) => ({ id, label: toNeedLabel(id) }));
}

async function handleDevTimeNeeds(request: Request, env: AuthDbEnv): Promise<Response> {
	const auth = await requireDeveloperAuth(request, env);
	if (!auth) return jsonResponse({ error: 'Developer access required' }, 403);
	return jsonResponse({ needs: getAllNeedOptions() });
}

async function handleDevTimeEvent(request: Request, env: AuthDbEnv): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) return jsonResponse({ error: 'Auth database is not configured' }, 503);
	const auth = await requireDeveloperAuth(request, env);
	if (!auth) return jsonResponse({ error: 'Developer access required' }, 403);

	const body = await parseBody(request);
	const trackerSessionId = typeof body.trackerSessionId === 'string' ? body.trackerSessionId.trim() : '';
	const eventType = typeof body.eventType === 'string' ? body.eventType.trim().toLowerCase() : '';
	const workType = typeof body.workType === 'string' ? body.workType.trim().toLowerCase() : '';
	const needId = sanitizeNeedId(body.needId);
	const eventAtRaw = Number(body.eventAt);
	const eventAt = Number.isFinite(eventAtRaw) && eventAtRaw > 0 ? Math.floor(eventAtRaw) : Date.now();

	if (!trackerSessionId) return jsonResponse({ error: 'trackerSessionId is required' }, 400);
	if (!isValidEventType(eventType)) return jsonResponse({ error: 'Invalid eventType' }, 400);
	if (!isValidWorkType(workType)) return jsonResponse({ error: 'Invalid workType' }, 400);

	const id = crypto.randomUUID();
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO dev_time_events
				(id, user_id, tracker_session_id, event_type, work_type, need_id, event_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, auth.user.id, trackerSessionId, eventType, workType, needId, eventAt, now)
		.run();

	return jsonResponse({ success: true, id });
}

async function handleDevTimeSave(request: Request, env: AuthDbEnv): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) return jsonResponse({ error: 'Auth database is not configured' }, 503);
	const auth = await requireDeveloperAuth(request, env);
	if (!auth) return jsonResponse({ error: 'Developer access required' }, 403);

	const body = await parseBody(request);
	const trackerSessionId = typeof body.trackerSessionId === 'string' ? body.trackerSessionId.trim() : '';
	const workType = typeof body.workType === 'string' ? body.workType.trim().toLowerCase() : '';
	const needId = sanitizeNeedId(body.needId);
	const startTime = Math.floor(Number(body.startTime));
	const endTime = Math.floor(Number(body.endTime));
	const durationMinutes = Math.floor(Number(body.durationMinutes));

	if (!trackerSessionId) return jsonResponse({ error: 'trackerSessionId is required' }, 400);
	if (!isValidWorkType(workType)) return jsonResponse({ error: 'Invalid workType' }, 400);
	if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
		return jsonResponse({ error: 'Invalid startTime/endTime' }, 400);
	}
	if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 24 * 60) {
		return jsonResponse({ error: 'Invalid durationMinutes' }, 400);
	}

	if (durationMinutes === 0) {
		return jsonResponse({ success: true, reset: true });
	}

	const id = crypto.randomUUID();
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO dev_time_entries
				(id, user_id, tracker_session_id, work_type, need_id, start_time, end_time, duration_minutes, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, auth.user.id, trackerSessionId, workType, needId, startTime, endTime, durationMinutes, now)
		.run();

	return jsonResponse({ success: true, id });
}

function toDatePartsInOffset(epochMs: number, tzOffsetMinutes: number): { year: number; month: number; day: number; weekday: number } {
	const adjusted = new Date(epochMs - tzOffsetMinutes * 60_000);
	return {
		year: adjusted.getUTCFullYear(),
		month: adjusted.getUTCMonth(),
		day: adjusted.getUTCDate(),
		weekday: adjusted.getUTCDay()
	};
}

function localDateToEpoch(year: number, month: number, day: number, tzOffsetMinutes: number): number {
	return Date.UTC(year, month, day) + tzOffsetMinutes * 60_000;
}

function computeSummaryRanges(nowMs: number, tzOffsetMinutes: number): {
	sevenDayStart: number;
	thisWeekStart: number;
	thisWeekEnd: number;
	prevWeekStart: number;
	prevWeekEnd: number;
} {
	const parts = toDatePartsInOffset(nowMs, tzOffsetMinutes);
	const todayStart = localDateToEpoch(parts.year, parts.month, parts.day, tzOffsetMinutes);
	const thisWeekStart = todayStart - parts.weekday * 24 * 60 * 60 * 1000;
	const thisWeekEnd = thisWeekStart + 7 * 24 * 60 * 60 * 1000;
	const prevWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
	const prevWeekEnd = thisWeekStart;
	const sevenDayStart = nowMs - 7 * 24 * 60 * 60 * 1000;
	return { sevenDayStart, thisWeekStart, thisWeekEnd, prevWeekStart, prevWeekEnd };
}

type SummaryRow = { dev: number; adm: number; copy: number };

function emptySummaryRow(): SummaryRow {
	return { dev: 0, adm: 0, copy: 0 };
}

async function readDurationByWorkType(
	db: D1Database,
	userId: string,
	startAt: number,
	endAt: number
): Promise<SummaryRow> {
	const rows = await db
		.prepare(
			`SELECT work_type, COALESCE(SUM(duration_minutes), 0) AS total
			 FROM dev_time_entries
			 WHERE user_id = ? AND end_time >= ? AND end_time < ?
			 GROUP BY work_type`
		)
		.bind(userId, startAt, endAt)
		.all<{ work_type: string; total: number }>();

	const out = emptySummaryRow();
	for (const row of rows.results || []) {
		const key = normalizeRole(row.work_type);
		const total = Number(row.total || 0);
		if (key === 'dev') out.dev = total;
		if (key === 'adm') out.adm = total;
		if (key === 'copy') out.copy = total;
	}
	return out;
}

async function handleDevTimeSummary(request: Request, env: AuthDbEnv, url: URL): Promise<Response> {
	const db = env.AUTH_DB;
	if (!db) return jsonResponse({ error: 'Auth database is not configured' }, 503);
	const auth = await requireDeveloperAuth(request, env);
	if (!auth) return jsonResponse({ error: 'Developer access required' }, 403);

	const tzOffsetMinutesRaw = Number(url.searchParams.get('tzOffsetMinutes'));
	const tzOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw) ? Math.max(-14 * 60, Math.min(14 * 60, Math.floor(tzOffsetMinutesRaw))) : 0;
	const now = Date.now();
	const ranges = computeSummaryRanges(now, tzOffsetMinutes);

	const [pastSevenDays, thisWeek, previousWeek] = await Promise.all([
		readDurationByWorkType(db, auth.user.id, ranges.sevenDayStart, now),
		readDurationByWorkType(db, auth.user.id, ranges.thisWeekStart, ranges.thisWeekEnd),
		readDurationByWorkType(db, auth.user.id, ranges.prevWeekStart, ranges.prevWeekEnd)
	]);

	return jsonResponse({
		summary: {
			pastSevenDays,
			thisWeek,
			previousWeek
		}
	});
}

async function requireAuthUser(request: Request, env: AuthDbEnv): Promise<AuthUser | null> {
	const db = env.AUTH_DB;
	if (!db) return null;
	const sessionToken = readSessionCookie(request);
	if (!sessionToken) return null;
	const sessionHash = await sha256Base64Url(sessionToken);
	const now = Date.now();

	const row = await db
		.prepare(
			`SELECT s.id, s.user_id, s.session_hash, s.created_at, s.last_seen_at, s.expires_at, s.absolute_expires_at, s.revoked_at,
			        u.email
			 FROM auth_sessions s
			 JOIN auth_users u ON u.id = s.user_id
			 WHERE s.session_hash = ?
			 LIMIT 1`
		)
		.bind(sessionHash)
		.first<(AuthSession & { email: string })>();

	if (!row) return null;
	if (row.revoked_at) return null;
	if (row.expires_at < now || row.absolute_expires_at < now) return null;

	await db
		.prepare('UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
		.bind(now, Math.min(now + SESSION_IDLE_MS, row.absolute_expires_at), row.id)
		.run();

	const user = { id: row.user_id, email: row.email };
	await ensureConfiguredDeveloperRole(db, env, user);
	return user;
}

async function ensureAuthTables(db: D1Database): Promise<void> {
	for (const sql of TABLES_SQL) {
		await db.prepare(sql).run();
	}
}

function getAuthOrigin(url: URL, env: AuthDbEnv): string {
	const configured = (env.AUTH_ORIGIN || '').trim();
	if (configured) return configured.replace(/\/$/, '');
	return url.origin;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...extraHeaders
		}
	});
}

function isFormRequest(request: Request): boolean {
	const contentType = request.headers.get('content-type') || '';
	return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try {
			const parsed = await request.json<unknown>();
			if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
			return {};
		} catch {
			return {};
		}
	}
	if (isFormRequest(request)) {
		const form = await request.formData();
		const out: Record<string, unknown> = {};
		form.forEach((v, k) => {
			out[k] = typeof v === 'string' ? v : '';
		});
		return out;
	}
	return {};
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	const out: Record<string, string> = {};
	for (const part of cookieHeader.split(';')) {
		const idx = part.indexOf('=');
		if (idx <= 0) continue;
		const key = part.slice(0, idx).trim();
		const val = part.slice(idx + 1).trim();
		out[key] = val;
	}
	return out;
}

function readSessionCookie(request: Request): string | null {
	const cookies = parseCookies(request.headers.get('cookie'));
	const raw = cookies[SESSION_COOKIE_NAME];
	if (!raw) return null;
	try {
		return decodeURIComponent(raw);
	} catch {
		return null;
	}
}

function buildSessionCookie(sessionToken: string): string {
	const encoded = encodeURIComponent(sessionToken);
	const maxAge = Math.floor(SESSION_IDLE_MS / 1000);
	return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function randomToken(bytes = 32): string {
	const raw = new Uint8Array(bytes);
	crypto.getRandomValues(raw);
	return base64Url(raw);
}

function base64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return base64Url(new Uint8Array(digest));
}

function getClientIp(request: Request): string {
	return request.headers.get('cf-connecting-ip') || 'unknown';
}

async function sendMagicLinkEmail(
	request: Request,
	env: AuthDbEnv,
	email: string,
	magicLink: string
): Promise<{ ok: true; devLink?: string } | { ok: false; error: string }> {
	const apiKey = (env.RESEND_API_KEY || '').trim();
	const fromEmail = (env.AUTH_FROM_EMAIL || '').trim();

	if (!apiKey || !fromEmail) {
		const host = new URL(request.url).hostname;
		if (host === 'localhost' || host === '127.0.0.1') {
			console.log(`[auth][dev] Magic link for ${email}: ${magicLink}`);
			return { ok: true, devLink: magicLink };
		}
		return { ok: false, error: 'Email provider is not configured yet' };
	}

	const html = [
		'<p>Sign in to ServeWell.Net:</p>',
		`<p><a href="${escapeHtml(magicLink)}">${escapeHtml(magicLink)}</a></p>`,
		'<p>This link expires in 15 minutes and can only be used once.</p>'
	].join('');

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: fromEmail,
			to: [email],
			subject: 'Your ServeWell.Net sign-in link',
			html
		})
	});

	if (!response.ok) {
		const details = await response.text();
		console.error('[auth] resend error', response.status, details);
		return { ok: false, error: 'Could not send login email right now' };
	}

	return { ok: true };
}

function respondConsumeFailure(request: Request, message: string, status: number): Response {
	if (isFormRequest(request)) {
		const html = [
			'<!doctype html>',
			'<html lang="en">',
			'<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign-In Error | ServeWell.Net</title></head>',
			'<body style="font-family:sans-serif;margin:2rem;">',
			`<p>${escapeHtml(message)}</p>`,
			'<p><a href="/">Return to home</a></p>',
			'</body></html>'
		].join('');
		return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
	}
	return jsonResponse({ error: message }, status);
}

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

		const authUser = await requireAuthUser(request, env as AuthDbEnv);
		const isVerifiedVote = Boolean(authUser);
		const voteScope = isVerifiedVote ? 'verified' : 'unverified';
		const voteActor = authUser?.id || getClientIp(request);
		const voteKey = `vote:${voteScope}:${featureId}:${voteActor}`;

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
			if (isVerifiedVote) {
				votes[featureId].verified_up = Math.max(0, votes[featureId].verified_up - 1);
			} else {
				votes[featureId].unverified_up = Math.max(0, votes[featureId].unverified_up - 1);
			}
		} else if (previousDirection === 'down') {
			if (isVerifiedVote) {
				votes[featureId].verified_down = Math.max(0, votes[featureId].verified_down - 1);
			} else {
				votes[featureId].unverified_down = Math.max(0, votes[featureId].unverified_down - 1);
			}
		}

		// Apply new vote in the appropriate bucket.
		if (direction === 'up') {
			if (isVerifiedVote) {
				votes[featureId].verified_up++;
			} else {
				votes[featureId].unverified_up++;
			}
		} else if (direction === 'down') {
			if (isVerifiedVote) {
				votes[featureId].verified_down++;
			} else {
				votes[featureId].unverified_down++;
			}
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
			vote_scope: voteScope,
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
