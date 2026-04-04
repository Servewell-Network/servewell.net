# ServeWell.Net

ServeWell.Net is a Cloudflare Workers site focused on Bible reading, comparative views, and tools that help people serve others well.

Most product details now live on the website itself:

- `/features` for currently available capabilities
- `/whats-next` for roadmap items and direction
- `/about` for mission and contribution context

## Project Guidance

- For architecture/modularity principles and coding guardrails, see [AGENTS.md](AGENTS.md).

## Local Development

Requirements:

- Node.js 22+
- npm

Install dependencies:

```bash
npm install
```

Run locally (Wrangler):

```bash
npm run dev
```

Useful commands:

- `npm run deploy` deploy Worker + assets
- `npm run cf-typegen` regenerate Cloudflare types
- `npm run test` run tests
- `npm run build:servewell-app-shell` bundle browser app shell

## Auth Setup (Magic Links)

Implemented auth endpoints:

- `POST /api/auth/request-link`
- `GET /auth/verify?token=...`
- `POST /api/auth/consume`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Required auth config:

- `AUTH_DB` as a D1 database binding
- `AUTH_FROM_EMAIL` as a Wrangler `vars` value
- `RESEND_API_KEY` as a Wrangler secret

Optional:

- `AUTH_ORIGIN` as a Wrangler `vars` value when you want magic links to use an explicit canonical origin

Notes:

- Magic link tokens are single-use and expire in 15 minutes.
- Sessions use secure cookies with 30-day idle timeout and 90-day absolute lifetime.
- On localhost, if email settings are missing, the API returns a `dev_magic_link` for testing.

Suggested Cloudflare setup:

```bash
npx wrangler d1 create servewell-auth
npx wrangler secret put RESEND_API_KEY
```

Then update `wrangler.jsonc` with the returned D1 `database_id`, and add these vars:

```jsonc
"vars": {
	"AUTH_FROM_EMAIL": "noreply@example.com",
	"AUTH_ORIGIN": "https://servewell.net"
}
```

Finally redeploy:

```bash
npx wrangler deploy
```

## Content Generation Scripts

This repository includes phased data-processing scripts used to generate chapter pages and related assets.

- `npm run p2-3` regenerates chapter HTML into `public/-/`
- `npm run p1a-2`, `npm run p1b-2`, and related review scripts support earlier data phases

## Source Data and Attribution

ServeWell.Net uses and derives from generous upstream Bible data/resources, including:

- STEPBible data: https://github.com/STEPBible/STEPBible-Data
- Berean Standard Bible resources: https://berean.bible/

Please preserve and extend attribution where required when updating data workflows.

