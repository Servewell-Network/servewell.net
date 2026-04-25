/**
 * word-search.spec.ts
 *
 * End-to-end tests for the word search feature, verifying that known
 * phrases surface the expected Bible verses in the results panel.
 *
 * These tests require live internet access: the word search module
 * fetches its word index and per-word verse data from words.servewell.net
 * (Cloudflare R2). Allow up to 20 seconds per search for those fetches.
 *
 * Token-resolution summary (stop words filtered, then lemmatized):
 *   Q1 "the lord is my shepherd"  → ['lord', 'my', 'shepherd']  (resolved: all 3)
 *   Q2 "god so loved the world"   → ['god', 'loved', 'world']   (resolved: all 3 → 'love')
 *   Q3 "god so loved the world t" → ['god', 'loved', 'world', 't']
 *      't' is not in the index and prefix-matches 355 keys (> MAX_CANDIDATES=40)
 *      → ambiguous → silently dropped → effective query same as Q2.
 *      Per code analysis Q3 should pass; test.fail() reflects the user's
 *      observed behaviour until confirmed otherwise.
 */

import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const SEARCH_BTN   = '#ws-search-topbar-btn';   // injected by app shell
const SEARCH_INPUT = '#ws-search-input';          // inside the search popover
const VERSE_REFS   = '#ws-search-results li[data-vr] .ws-sr-ref';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Open the search popover and fill the query. */
async function openAndSearch(page: Page, query: string): Promise<void> {
  // The search button is injected by servewell-app-shell.js — wait for it.
  await page.locator(SEARCH_BTN).waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator(SEARCH_BTN).click();
  await expect(page.locator('#ws-search-popover')).toBeVisible();
  await page.locator(SEARCH_INPUT).fill(query);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('word search — known phrase results', () => {
  test.beforeEach(async ({ page }) => {
    // Use a stable, short chapter page as the host for all three searches.
    await page.goto('/-/Genesis/1');
  });

  test('"the lord is my shepherd" — Psalms 23:1 is the first result', async ({ page }) => {
    await openAndSearch(page, 'the lord is my shepherd');
    // Resolved: 'lord' (13 files), 'my' (6 files), 'shepherd' (4 files).
    // Primary (rarest) = 'shepherd'. Canonical order places Psalms 23:1 first
    // in the intersection because no earlier verse has all three lemmas together.
    await expect(
      page.locator(VERSE_REFS).first()
    ).toContainText('Psalms 23:1', { timeout: 20_000 });
  });

  test('"god so loved the world" — John 3:16 appears in the results', async ({ page }) => {
    await openAndSearch(page, 'god so loved the world');
    // Stop words "so" and "the" are filtered; 'loved' lemmatises to 'love'.
    // Resolved: 'world' (5 files), 'love' (11 files), 'god'. Intersection
    // over the full corpus includes John 3:16.
    await expect(
      page.locator(VERSE_REFS).filter({ hasText: 'John 3:16' })
    ).toBeVisible({ timeout: 20_000 });
  });

  // The trailing "t" resolves as ambiguous (not unresolved), so it is silently
  // excluded from the resolved lemma set and from the trad-text expansion
  // patterns. The effective search is identical to the query above and surfaces
  // John 3:16.
  test('"god so loved the world t" — trailing partial token does not block John 3:16', async ({ page }) => {
    await openAndSearch(page, 'god so loved the world t');
    await expect(
      page.locator(VERSE_REFS).filter({ hasText: 'John 3:16' })
    ).toBeVisible({ timeout: 20_000 });
  });
});
