# Chapter Pages 404 — Mitigation Details

> This document describes the **temporary self-healing infrastructure** added on Apr 28 2026
> (commit `fix: reduce downtime for chapter pages`) to reduce user-visible downtime while the
> underlying Cloudflare assets bug remains unresolved.
>
> **All of this is intended to be removed** once the root cause is fixed or a durable Cloudflare
> workaround is found. See [public-chap-files-404-issue.txt](public-chap-files-404-issue.txt)
> for the full history.

---

## Background

Cloudflare Workers Static Assets intermittently stops serving files under `public/-/` with HTTP
404. The problem is not in the files themselves — a plain `npx wrangler deploy` (even one that
uploads no new files) restores service within seconds. The leading theory is that Cloudflare edge
nodes lose their local reference to the asset binding for this worker and fall back to a 404 rather
than fetching from the asset store.

## What Was Added

### 1. `env.ASSETS.fetch()` fallback in the request handler

Previously, the worker returned a hardcoded `404 Not Found` for any route that wasn't an API or
auth path. That was replaced with:

```typescript
const assetResponse = await env.ASSETS.fetch(request);
if (assetResponse.status === 404 && url.pathname.startsWith('/-/')) {
    ctx.waitUntil(triggerSelfHeal(url.pathname, env));
}
return assetResponse;
```

When an asset 404 hits a `/-/` path the self-heal function fires non-blocking via `ctx.waitUntil`.
The current request still returns 404 to the user; subsequent requests within a few seconds
succeed after the re-promote propagates.

### 2. `triggerSelfHeal()` — API-based re-promotion

```
GET  https://api.cloudflare.com/…/workers/scripts/servewellnet/deployments
        → extract latest version_id from result.deployments[0].versions[0].version_id
POST https://api.cloudflare.com/…/workers/scripts/servewellnet/deployments
        → body: { versions: [{ version_id, percentage: 100 }] }
```

This is equivalent to running `npx wrangler deploy` from the terminal, but callable from inside
the worker at runtime. The version ID is fetched dynamically so it never goes stale after a new
deploy.

**Cooldown**: A KV key `cooldown` (TTL 300 s) prevents multiple concurrent re-promotions. If a
second 404 is detected within 5 minutes of a successful re-promote, it is silently skipped.

**Credential**: The `CF_WORKER_API_TOKEN` secret is stored as a Cloudflare Worker secret (set via
`wrangler versions secret put CF_WORKER_API_TOKEN`). It has Workers Scripts:Edit scope on the
`servewellnet` script only.

### 3. `runChapterHealthCheck()` — proactive cron probe

The cron schedule was changed from `*/15 * * * *` to `*/5 * * * *`. Each tick probes exactly one
chapter page using `env.ASSETS.fetch()` (no outbound HTTP). The probe target cycles through 75
slots (5 books × 15 chapters) based on wall-clock time:

```
slot = Math.floor(Date.now() / 5min) % 75
book = HEALTH_CHECK_BOOKS[Math.floor(slot / 15)]
chapter = (slot % 15) + 1
```

Books: `Genesis`, `Matthew`, `Mark`, `Luke`, `John`. Chapters 1–15 of each.  
Full cycle time: 75 × 5 min = **6 hr 15 min**.

On a 404 response, `triggerSelfHeal()` is called with the same shared cooldown as the
request-level detector. This means recovery can happen even if no real user happens to hit an
affected page.

### 4. `RECOVERY_LOG` KV namespace

All self-heal attempts (successful or not) are appended to a log stored under key `log` in the
`RECOVERY_LOG` KV namespace.

Structure:
```json
{
  "first": [ ...up to 5 earliest entries... ],
  "last":  [ ...5 most recent entries... ],
  "total": 12
}
```

Each entry:
```json
{
  "ts": 1745123456789,
  "path": "/-/Genesis/1",
  "redeployed": true,
  "deployId": "4519d66f-ab05-460f-93b9-387389c286e1",
  "error": null
}
```

### 5. API endpoints (moderator auth required)

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/recovery-log` | Returns the `RecoveryLogData` JSON |
| `DELETE` | `/api/recovery-log` | Clears `log` and `cooldown` KV keys |

Both require a valid moderator session cookie (same as the moderation queue endpoints).

### 6. `scripts/cf-redeploy.sh` — manual recovery script

For use from the developer's terminal when automation has not yet triggered or when you want to
force an immediate re-promote:

```bash
npm run cf-redeploy
```

The script reads `CF_WORKER_API_TOKEN` from `.env`, fetches the current version ID dynamically,
posts the re-promote, waits 5 seconds, and prints the HTTP status of `/-/Genesis/1`.

---

## Bindings Added

| Type | Binding | ID / Value |
|------|---------|-----------|
| KV Namespace | `RECOVERY_LOG` | `e528a388e4874f0689dadaa68e85b70f` |
| Worker Secret | `CF_WORKER_API_TOKEN` | (secret — Workers Scripts:Edit scope) |

---

## What to Remove When the Root Cause Is Fixed

- `triggerSelfHeal()` and `appendRecoveryLog()` functions in `src/index.ts`
- `runChapterHealthCheck()` and `HEALTH_CHECK_BOOKS` / `HEALTH_CHECK_CHAPTERS` constants
- The `ctx.waitUntil(triggerSelfHeal(...))` call in the fetch handler
- The `runChapterHealthCheck(env)` call in the `scheduled` handler
- `handleGetRecoveryLog()` and `handleClearRecoveryLog()` handler functions
- The two `/api/recovery-log` route entries in the fetch dispatch table
- `CF_ACCOUNT_ID` and `CF_SCRIPT_NAME` constants (if not needed elsewhere)
- `CF_WORKER_API_TOKEN` secret binding (can be deleted via Cloudflare dashboard or `wrangler secret delete`)
- `RECOVERY_LOG` KV namespace (can be deleted via `wrangler kv namespace delete`)
- The `RECOVERY_LOG` entry in `wrangler.jsonc` `kv_namespaces`
- `CF_WORKER_API_TOKEN` from `worker-configuration.d.ts` `Env` interface
- `RECOVERY_LOG` from `worker-configuration.d.ts` `Env` interface
- `scripts/cf-redeploy.sh`
- `"cf-redeploy"` npm script entry in `package.json`
- Cron schedule can revert to `*/15 * * * *` (or whatever cadence is appropriate)
