# Testing and CI/CD Plan

This document is the implementation spec for automated testing and a CI/CD pipeline
for ServeWell.Net. It is designed to be checked in as-is and implemented incrementally.

---

## Current State

| Area | Status |
|---|---|
| Unit/integration tests | 3 tests via Vitest + `@cloudflare/vitest-pool-workers` |
| Coverage | Worker endpoints: votes, auth state |
| CI | None |
| CD | Manual `npx wrangler deploy` |
| E2E / browser tests | None |
| Type checking | TypeScript, run manually |
| Lint | None configured |

---

## Goals

1. Catch regressions before they reach production.
2. Prevent accidental deploy of broken code.
3. Keep the pipeline fast — < 2 minutes for the common path.
4. Leave deployment always in the human's hands (no auto-deploy to production).
5. Add tests incrementally with each feature — no big-bang test rewrite.

---

## Phase 1 — CI on Every Push (implement first)

### 1.1 GitHub Actions workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test -- --run
```

Notes:
- `npx tsc --noEmit` catches TypeScript errors that the editor might not surface.
- `npm test -- --run` exits after one pass (no watch mode) for CI.
- No secrets needed for this phase — tests run against the local KV/D1 mocks provided
  by `@cloudflare/vitest-pool-workers`.

### 1.2 Add `tsconfig.json` `strict` check

Currently `tsconfig.json` likely has `strict` disabled or partially enabled.
Confirm it is set to `"strict": true` and fix any resulting errors. This makes
type-checking in CI meaningful rather than perfunctory.

---

## Test Execution Context

Understanding **where** and **when** tests run is crucial for avoiding false confidence:

| Phase | Test Type | Where | When | Blocks Deploy? |
|---|---|---|---|---|
| 1 | Unit + typecheck | GitHub Actions | Every push to any branch | No (info only) |
| 1 | Unit + typecheck | Local | `npm test -- --run && npx tsc --noEmit` | No (info only) |
| 2 | Worker unit tests | GitHub Actions | Every push to any branch | No (info only) |
| 2 | Worker unit tests | Local | `npm test -- --run` before deploy | **Yes** (pre-deploy gate) |
| 3 | Playwright E2E | GitHub Actions | After Phase 1 passes | No (post-merge validation) |
| 3 | Playwright E2E | Local | `npm run test:e2e` before deploy (optional) | **Yes** (pre-deploy gate if run) |
| 3b | Visual inspection | Local only | `npm run pre-deploy` before deploy | **Yes** (human gate) |
| 2b | Phasing scripts | Local | `npm run test:phasing` before deploy | **Yes** (pre-deploy gate) |

**Key insight**: CI on GitHub validates that code doesn't break on *every* push. But only
local `npm run pre-deploy` gates an actual production deploy. This is intentional — humans
deploy when ready, not on every merge.

---

## Phase 2 — Expanded Worker Test Coverage

Add to `test/index.spec.ts` (or split into focused files under `test/`):

### 2.1 Vote endpoint edge cases

| Test | What it verifies |
|---|---|
| POST /api/vote/:id/up twice from same IP | Second request rejected (already voted) |
| POST /api/vote/:id/up then /neutral | Removes vote; unverified count returns to 0 |
| POST /api/vote/:id/down | Correct bucket (unverified_down) incremented |
| POST /api/vote with invalid direction | Returns 400 |
| POST /api/vote with too-short path | Returns 400 |
| GET /api/votes after multiple votes | Aggregated totals correct |

### 2.2 Auth endpoint coverage

| Test | What it verifies |
|---|---|
| POST /api/auth/request-link with invalid email | Returns 400 |
| POST /api/auth/request-link with valid email (no Resend key) | Returns dev magic link in response |
| POST /api/auth/consume with missing token | Returns error |
| POST /api/auth/consume with expired token | Returns error |
| POST /api/auth/logout without session | Returns success (idempotent) |
| GET /api/auth/me with valid session | Returns authenticated: true + email |

### 2.3 Static routing

| Test | What it verifies |
|---|---|
| GET /unknown-path | Returns 404 |
| GET /features.html (or /features) | Returns 200 with HTML content-type |

### Implementation note

Each test file should import from a shared `test/helpers.ts` that provides:
- `makeRequest(path, options)` — typed wrapper around `new Request`
- `makeAuthenticatedRequest(path, sessionToken)` — adds session cookie
- `createTestUser(db)` — inserts a user row directly into the D1 test DB

### Shared Test Fixtures

Create `test/fixtures/` directory with canonical sample data used across all test types:

**`test/fixtures/feature-ids.json`**:
```json
{
  "featureIds": [
    "need-new-feature-marker",
    "need-comments",
    "need-user-profiles",
    "need-offline-mode"
  ],
  "voteBuckets": ["unverified_up", "unverified_down", "verified_up", "verified_down"]
}
```

**Why**: When you rename `feat-*` to `need-*` or add a new feature, you update this file once.
All tests that reference it must then pass, catching any test-data inconsistency.

---

## Phase 2b — Phasing Scripts & Bible Output Tests

The phasing scripts (`src/phasingScripts/`) generate chapter HTML that is versioned into
the repo. These scripts are separate concerns from the Worker/frontend but share output
that affects user experience.

### 2b.1 Spot-check Bible verse output

Create `test/phasing.spec.ts` with exact equality checks for
`EnglishHeadingsAndWords` on the traditional version. These checks should fail on
any change to tokenization, morpheme mapping, or word ordering.

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type VerseSpotCheck = {
  reference: string;
  file: string;
  chapter: number;
  verse: number;
  expectedEnglishHeadingsAndWords: unknown;
};

const root = path.resolve(process.cwd());
const fixturePath = path.join(root, 'test/fixtures/bible-spot-checks.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  spotChecks: VerseSpotCheck[];
};

function extractEnglishHeadingsAndWords(
  json: unknown,
  chapter: number,
  verse: number
): unknown {
  const data = json as { chapter?: { c?: number; verses?: Array<{ v?: number; EnglishHeadingsAndWords?: unknown }> } };
  if (!data.chapter || data.chapter.c !== chapter || !Array.isArray(data.chapter.verses)) {
    throw new Error('Unexpected chapter JSON shape');
  }

  const verseNode = data.chapter.verses.find((item) => item.v === verse);
  if (!verseNode) {
    throw new Error(`Verse not found: ${chapter}:${verse}`);
  }
  return verseNode.EnglishHeadingsAndWords;
}

describe('Bible output quality', () => {
  const spotChecks = fixture.spotChecks;

  spotChecks.forEach((check) => {
    it(`matches EnglishHeadingsAndWords exactly for ${check.reference}`, () => {
      const filePath = path.join(root, check.file);
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const actual = extractEnglishHeadingsAndWords(json, check.chapter, check.verse);

      // Strict deep equality is the contract: exact words, order, and structure.
      expect(actual).toEqual(check.expectedEnglishHeadingsAndWords);
    });
  });
});
```

### 2b.2 Spot-check configuration file

Create `test/fixtures/bible-spot-checks.json`:
```json
{
  "spotChecks": [
    {
      "reference": "Genesis 1:1",
      "file": "src/json-Phase2/docs/01-Gen/Gen001.json",
      "chapter": 1,
      "verse": 1,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Genesis 1:2",
      "file": "src/json-Phase2/docs/01-Gen/Gen001.json",
      "chapter": 1,
      "verse": 2,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Genesis 1:3",
      "file": "src/json-Phase2/docs/01-Gen/Gen001.json",
      "chapter": 1,
      "verse": 3,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Genesis 12:1",
      "file": "src/json-Phase2/docs/01-Gen/Gen012.json",
      "chapter": 12,
      "verse": 1,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Genesis 12:2",
      "file": "src/json-Phase2/docs/01-Gen/Gen012.json",
      "chapter": 12,
      "verse": 2,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Genesis 12:3",
      "file": "src/json-Phase2/docs/01-Gen/Gen012.json",
      "chapter": 12,
      "verse": 3,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Exodus 3:14",
      "file": "src/json-Phase2/docs/02-Exo/Exo003.json",
      "chapter": 3,
      "verse": 14,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Leviticus 19:18",
      "file": "src/json-Phase2/docs/03-Lev/Lev019.json",
      "chapter": 19,
      "verse": 18,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Numbers 6:24",
      "file": "src/json-Phase2/docs/04-Num/Num006.json",
      "chapter": 6,
      "verse": 24,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Numbers 6:25",
      "file": "src/json-Phase2/docs/04-Num/Num006.json",
      "chapter": 6,
      "verse": 25,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Numbers 6:26",
      "file": "src/json-Phase2/docs/04-Num/Num006.json",
      "chapter": 6,
      "verse": 26,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Deuteronomy 6:4",
      "file": "src/json-Phase2/docs/05-Deu/Deu006.json",
      "chapter": 6,
      "verse": 4,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Deuteronomy 6:5",
      "file": "src/json-Phase2/docs/05-Deu/Deu006.json",
      "chapter": 6,
      "verse": 5,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Proverbs 3:5",
      "file": "src/json-Phase2/docs/20-Pro/Pro003.json",
      "chapter": 3,
      "verse": 5,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Proverbs 3:6",
      "file": "src/json-Phase2/docs/20-Pro/Pro003.json",
      "chapter": 3,
      "verse": 6,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Psalm 23:1",
      "file": "src/json-Phase2/docs/19-Psa/Psa023.json",
      "chapter": 23,
      "verse": 1,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Isaiah 53:5",
      "file": "src/json-Phase2/docs/23-Isa/Isa053.json",
      "chapter": 53,
      "verse": 5,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    },
    {
      "reference": "Jeremiah 29:11",
      "file": "src/json-Phase2/docs/24-Jer/Jer029.json",
      "chapter": 29,
      "verse": 11,
      "expectedEnglishHeadingsAndWords": [
        "<copy exact array from canonical baseline>"
      ]
    }
  ]
}
```

Baseline rule:
- Use committed JSON outputs as canonical baseline for these exact checks.
- Any intentional wording/morpheme mapping change requires updating fixture values in
  the same PR with an explanation in the commit message.
- Do not assert `<strong>`, `<em>`, or other presentation markup in this phase.

### 2b.3 Add test script to package.json

```json
{
  "scripts": {
    "test:phasing": "vitest run --include 'test/phasing.spec.ts'"
  }
}
```

And update pre-deploy to include:

```js
// In scripts/pre-deploy.js, add after typecheck passes:
console.log('\n🔤 Running phasing script spot checks...');
const phasing = spawn('npm', ['run', 'test:phasing', '--', '--run'], {
  stdio: 'inherit',
});
```

---

## Phase 3 — Frontend Unit Tests (lower priority; add incrementally)

**Why lower priority**: Frontend unit tests are valuable for complex state logic, but
early on, Playwright E2E tests (Phase 4) catch more issues per test written. Invest
in frontend unit tests when:

- A helper function (like vote bucketing logic, localStorage key formatting) has edge cases
- DOM manipulation has repeated transforms that need regression protection
- State transitions have complex preconditions

For example, `public/js/features-popovers.js` has localStorage key scoping logic:

```ts
// test/frontend/features-popovers.unit.ts
import { getStorageKey, seedBaselineFeatures } from '../../public/js/features-popovers';

describe('features-popovers.js', () => {
  it('scopes localStorage key by pathname', () => {
    const key = getStorageKey('/features');
    expect(key).toBe('servewell-viewed-features:/features');
  });

  it('treats /features and /features.html as same page', () => {
    const key1 = getStorageKey('/features');
    const key2 = getStorageKey('/features.html');
    expect(key1).toBe(key2);
  });

  it('seeds baseline with all feature IDs on first load', () => {
    // No localStorage key yet
    const baseline = seedBaselineFeatures([
      'need-new-feature-marker',
      'need-comments',
    ]);
    expect(baseline).toEqual([
      'need-new-feature-marker',
      'need-comments',
    ]);
    // localStorage is now set for this page
  });
});
```

Add these incrementally as you refactor or add JS logic. For now, skip this phase.

---

## Phase 4 — HTML/JS Smoke Tests (Playwright + responsive design)

These catch issues that unit tests cannot: feature table rendering, popover behavior,
vote UI updates, new-feature badge logic, and localStorage interactions.

### 4.1 Setup

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

Create `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  use: {
    baseURL: 'http://localhost:8787',
  },
  webServer: {
    command: 'npx wrangler dev --port 8787',
    url: 'http://localhost:8787',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
```

### 4.2 Initial E2E test cases (create in `test/e2e/`)

| File | Test | What it verifies |
|---|---|---|
| `features.spec.ts` | Features page loads | Table is present; all need-* rows visible |
| `features.spec.ts` | Clicking a feature name | Popover appears with title text |
| `features.spec.ts` | Clicking Votes cell | Vote popover appears with upvote/downvote buttons |
| `features.spec.ts` | No feat-* IDs present | Confirm migration complete |
| `whats-next.spec.ts` | What's Next page loads | Table is present; at least one row visible |
| `new-badge.spec.ts` | First visit — no New badges | No `.new-badge` elements on first load |
| `new-badge.spec.ts` | Second visit after baseline | Newly added item shows `.new-badge` |
| `auth.spec.ts` | Sign in button visible | Auth button visible in top bar |
| `auth.spec.ts` | Sign in modal opens | Clicking auth button shows email input |
| `responsive.spec.ts` | 375×600 layout | No horizontal scroll on narrow screen |
| `responsive.spec.ts` | 1280×800 layout | Layout uses full width gracefully |

### 4.3 Add E2E to CI

Extend `.github/workflows/ci.yml`:

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E tests (GitHub)
        run: npm run test:e2e
        env:
          CI: true
```

Note: E2E runs after unit tests pass (`needs: test`). The Wrangler dev server is
started automatically by Playwright's `webServer` config.

---

## Phase 5 — Pre-deploy Visual Inspection (human gate, required before deploy)

**This is the critical safety gate.** Code tests pass but miss UI/UX regressions,
responsive layout breaks, and cross-feature interactions. Before anyone can deploy,
they must visually inspect the site on both narrow (mobile) and wide (desktop) screens.

### 5.1 Visual test page flow

Create `public/visual-test-preview.html` (hidden from main nav) with:

1. **Responsive mockup slideshow**
   - Iframe 1: 375×600 (narrow, portrait)
   - Iframe 2: 1280×800 (wide, landscape)
   - Transitions one-per-page using spacebar or "Next" button
   - Points to `http://localhost:8787` (local dev server)

2. **Slides to inspect** (each screen size):
   - `/features` — feature table renders, badges visible, popovers work
   - `/whats-next` — table renders, no layout breaks
   - `/` (home) — any prominent UI updates
   - Vote flow — click upvote in feature popover, vote increments, UI updates
   - Auth flow — sign-in button visible, modal works on both sizes
   - Any new pages added this release

3. **Validation checklist** (user fills in):
   - Narrow screen: no horizontal scroll, text readable, buttons tappable
   - Wide screen: layout uses full width gracefully
   - Popovers: appear in correct position, don't overflow
   - Badges: `.new-badge` visible where expected, invisible where not expected
   - Vote totals: correct after interaction
   - Auth state: reflected in UI
   - No console errors (inspector visible)

### 5.2 Add `npm run pre-deploy` script

```json
{
  "scripts": {
    "pre-deploy": "node scripts/pre-deploy.js"
  }
}
```

`scripts/pre-deploy.js`:
```js
#!/usr/bin/env node
const { spawn } = require('child_process');

console.log('Running pre-deploy checks...\n');

// 1. Run all tests
console.log('1️⃣  Running unit tests...');
const test = spawn('npm', ['test', '--', '--run'], { stdio: 'inherit' });

test.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Tests failed. Aborting.\n');
    process.exit(1);
  }

  // 2. Run type check
  console.log('\n2️⃣  Running type check...');
  const typecheck = spawn('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });

  typecheck.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Type check failed. Aborting.\n');
      process.exit(1);
    }

    // 3. Start dev server and open visual test
    console.log('\n3️⃣  Starting dev server...');
    const dev = spawn('npx', ['wrangler', 'dev', '--port', '8787'], {
      stdio: 'inherit',
    });

    setTimeout(() => {
      console.log('\n📱 Opening visual test page...');
      console.log('http://localhost:8787/visual-test-preview.html\n');
      console.log('Inspect both narrow and wide screens. Use spacebar or "Next" button to advance.');
      console.log('When done, close this terminal and wrangler will stop.\n');
    }, 3000);

    process.on('SIGINT', () => {
      dev.kill();
      process.exit(0);
    });
  });
});
```

### 5.3 Final deploy prompt

After closing the dev server:

```js
// In pre-deploy.js, after visual inspection
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  '\n✅ Ready to deploy? (y/n) ',
  (answer) => {
    if (answer.toLowerCase() === 'y') {
      console.log('🚀 Deploying...\n');
      const deploy = spawn('npx', ['wrangler', 'deploy'], { stdio: 'inherit' });
      deploy.on('close', (code) => {
        process.exit(code);
      });
    } else {
      console.log('Abort.\n');
      process.exit(0);
    }
    rl.close();
  }
);
```

---

## Test Boundaries & Selective Testing

Not all tests need to run for every change. Gate tests by the code area changed to keep
feedback loop fast and avoid false negatives (e.g., backend changes shouldn't block on
frontend E2E).

### Interface contracts (JSON Schema)

Define shared interfaces to catch contract breakage:

**`test/schemas/api-contracts.json`**:
```json
{
  "vote": {
    "request": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "featureId": { "type": "string", "pattern": "^need-[a-z-]+$" },
        "direction": { "enum": ["up", "down", "neutral"] }
      },
      "required": ["featureId", "direction"]
    },
    "response": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "total_up": { "type": "number" },
        "total_down": { "type": "number" }
      }
    }
  },
  "chapter": {
    "output": {
      "type": "object",
      "properties": {
        "bookId": { "type": "string" },
        "chapter": { "type": "number" },
        "verses": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "reference": { "type": "string", "pattern": "^[A-Z 0-9:]+$" },
              "text": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### Selective test command

Update `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --include 'test/**/*.spec.ts' --exclude 'test/e2e/**' --exclude 'test/phasing.spec.ts'",
    "test:phasing": "vitest --include 'test/phasing.spec.ts'",
    "test:e2e": "playwright test",
    "test:api-only": "vitest --include 'test/index.spec.ts'",
    "test:only-changed": "vitest --changed"
  }
}
```

**Usage for developers**:
- Backend change to `src/index.ts` ➔ `npm run test:api-only`
- New phasing script logic ➔ `npm run test:phasing`
- Frontend markup change ➔ `npm run test:e2e -- features.spec.ts`
- Full pre-deploy validation ➔ `npm run pre-deploy` (runs all phases)

---

## Feature Coverage Map

This table shows which tests cover each user-facing feature. Use this to identify gaps
when adding new features.

| Feature | Phase 1 Unit | Phase 2 Unit | Phase 2b Phasing | Phase 4 E2E | Visual Test (5) |
|---|---|---|---|---|---|
| Vote up/down | ✅ POST test | ✅ edge cases | — | ✅ click Votes | ✅ click button |
| Vote aggregate totals | ✅ GET test | ✅ after 2+ votes | — | ✅ popover shows total | ✅ visual check |
| Auth sign-in | ✅ /api/auth/me | ✅ full flow | — | ✅ modal opens | ✅ button visible |
| Auth logout | ✅ /api/auth/me | ✅ idempotent | — | ✅ UI updates | ✅ visual check |
| Feature table render | — | — | — | ✅ rows visible | ✅ layout check |
| Feature popovers | — | — | — | ✅ click opens | ✅ position check |
| New-feature badge | — | — | — | ✅ first/second visit | ✅ badge visibility |
| Responsive layout | — | — | — | ✅ narrow/wide | ✅ slideshow |
| Bible chapter output | — | — | ✅ spot-checks | — | — |
| need-* IDs (no feat-*) | — | — | — | ✅ assert absence | ✅ visual |

**Gaps to fill** (on next feature):
- Frontend state management (localStorage, vote UI updates) — Phase 3 unit test
- Auth cookie expiry — Phase 2 unit test

### Feature Inventory Drift Check

To surface features that exist in code but are not listed on the features page,
add a shared registry and enforce parity:

- Create `src/shared/feature-inventory.json` as the single source of truth for
  all `need-*` feature IDs.
- Render features table rows from this registry (or validate static HTML against it).
- Add test `test/feature-inventory.spec.ts`:
  - Parse `public/features.html` and collect row IDs (`need-*`).
  - Compare sorted IDs to registry IDs.
  - Fail if any registry ID is missing from the page.
  - Fail if the page contains IDs not in the registry.

This check directly answers: "Are there features not yet on the features page?"
If yes, CI fails with a list of mismatches.

---

## Phase 6 — Optional Future Additions

These are lower priority and should be implemented after Phases 1–5 are stable.

| Addition | Value |
|---|---|
| Coverage reporting (c8/istanbul via vitest) | Understand which code paths have no tests |
| Dependabot or Renovate | Automatic PRs for dependency updates |
| Lint (eslint + `@typescript-eslint`) | Consistent code style, catch common errors |
| Secrets scanning (trufflehog or GitHub native) | Prevent accidental credential commits |
| Lighthouse CI | Track performance/accessibility score regressions across deploys |
| Wrangler tail integration test | Confirm observability works after each deploy |

---

## Implementation Order Summary

1. **Phase 1** — Create `.github/workflows/ci.yml`, confirm `tsc --noEmit` is clean.
   Commit and push. CI should go green immediately.

2. **Phase 2** — Add missing Worker unit tests to `test/index.spec.ts` (or new files).
   Focus on vote edge cases and auth flow coverage. Do not need to do all at once.

3. **Phase 2b** — Add `test/phasing.spec.ts` with exact `EnglishHeadingsAndWords`
  equality checks for the selected verses. Create
  `test/fixtures/bible-spot-checks.json` with the full verse list above. Update
  `scripts/pre-deploy.js` to run phasing tests.

4. **Phase 3** — Skip for now unless you refactor frontend logic. Add incrementally
   when you extract helpers or add complex state transitions.

5. **Phase 4** — Install Playwright, add `playwright.config.ts`, write the initial
   eleven E2E smoke tests. Add E2E job to CI.

6. **Phase 5** — Create `public/visual-test-preview.html` with responsive slideshow.
   Implement `scripts/pre-deploy.js` that runs all tests, starts dev server, opens
   visual test page, and gates final deploy on human confirmation.

7. **Phase 6** — Pick from optional additions based on what proves most valuable.

---

*Last updated: April 6, 2026*
