/**
 * generateWordStudyHtml.ts
 *
 * Reads JSON word study files from src/json-Phase2/words/ and emits one HTML
 * file per JSON into dist/words/.
 *
 * Each page embeds its source JSON as a <script type="application/json" id="ws-data">
 * island. The standalone servewell-word-page.js script reads that island and
 * renders the full UI client-side.
 *
 * For browsers without JS: the raw JSON is visible as plain text in #ws-raw.
 * A tiny inline <script> that runs before paint adds class "js" to <html>,
 * which hides #ws-raw and shows the loading placeholder (#ws-render) instead.
 *
 * Must be run AFTER generateWordStudyJson.ts (npm run p2-words).
 * Run: npm run p2-words-html
 */

import fs from 'fs';
import path from 'path';
import { makeHtmlBase } from './phase2To3/makeHtmlBase';

const ROOT = path.resolve(process.cwd());
const IN_DIR  = path.join(ROOT, 'src/json-Phase2/words');
const OUT_DIR = path.join(ROOT, 'dist/words');

// Absolute URLs required: word pages are served from words.servewell.net.
const APP_SHELL_TAG  = `<script src="https://servewell.net/js/servewell-app-shell.js"></script>`;
const WORD_PAGE_TAG  = `<script src="https://servewell.net/js/servewell-word-page.js"></script>`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MetaOut {
  wordKey: string; fileNumber: number;
  strongsId: string; lang: string; lemma: string;
  rootTranslation?: string; transliteration?: string; totalInstances: number; totalSlots: number;
}
interface MainWordFile { ancientWord: { _meta: MetaOut; [k: string]: unknown }; [k: string]: unknown; }
interface OverflowFile { type: 'overflow'; label: string; ancientWord: { _meta: MetaOut; [k: string]: unknown }; }
interface RedirectFile { _redirect: string; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// CSS for word pages (same design tokens as before)
// ---------------------------------------------------------------------------
const PAGE_CSS = `
<style>
html.js #ws-raw { display: none; }
:root {
  color-scheme: light;
  --page-bg: #f4f6f9; --page-fg: #0f172a; --muted: #475467;
  --label-bg: #f8fafc; --pane-bg: #ffffff; --pane-border: #dbe3ea; --link: #1d4ed8;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page-bg: #0b1220; --page-fg: #e5edf7; --muted: #a6b3c5;
  --label-bg: #172235; --pane-bg: #101a2a; --pane-border: #2a3b52; --link: #8ab4ff;
}
body { background: var(--page-bg); color: var(--page-fg); }
a { color: var(--link); }
.ws-meta { margin-bottom: 1.5rem; line-height: 1.6; }
.ws-meta-stats { font-size: 0.85rem; color: var(--muted); margin: 0.3rem 0 0; }
.ws-title-sub { font-size: 0.45em; font-weight: normal; font-variant: normal; letter-spacing: normal; color: var(--muted); margin-left: 0.4em; }
.ws-expand-btn { margin-left: 0.6rem; padding: 0.1rem 0.55rem; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--pane-border); border-radius: 4px; background: var(--label-bg); color: var(--page-fg); vertical-align: middle; }
.ws-slot { border-top: 2px solid var(--pane-border); padding-top: 1rem; margin-top: 1.75rem; }
.ws-slot-highlighted { border-top-color: var(--link); }
.ws-grammar-full { font-size: 1rem; font-weight: 600; margin: 0 0 0.2rem; color: var(--page-fg); }
.ws-slot-stats { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.75rem; }
.ws-translation { margin: 0.8rem 0 0.8rem 0.5rem; }
.ws-rendering { font-size: 0.95rem; font-weight: 700; font-variant: small-caps; letter-spacing: 0.02em; margin: 0 0 0.4rem; }
.ws-count { font-weight: 400; font-variant: normal; color: var(--muted); font-size: 0.85em; }
.ws-instance { background: var(--pane-bg); border-left: 3px solid var(--pane-border); padding: 0.4rem 0.7rem; margin: 0.3rem 0; border-radius: 0 4px 4px 0; }
.ws-ref { display: block; font-size: 0.78rem; font-weight: 600; color: var(--muted); margin-bottom: 0.15rem; }
a.ws-ref { color: var(--link); text-decoration: none; }
a.ws-ref:hover { text-decoration: underline; }
.ws-trad { margin: 0 0 0.2rem; font-size: 0.9rem; }
.ws-lit { margin: 0; font-size: 0.85rem; color: var(--muted); font-style: italic; }
mark.ws-target { background: #fef08a; color: #1a1200; border-radius: 2px; padding: 0 1px; font-style: normal; }
:root[data-theme="dark"] mark.ws-target { background: #5a3e00; color: #fde68a; }
.ws-more summary { cursor: pointer; font-size: 0.85rem; color: var(--link); padding: 0.2rem 0; margin-top: 0.25rem; }
.ws-overflow-note { font-size: 0.82rem; color: var(--muted); font-style: italic; margin: 0.4rem 0 0; }
.ws-back-link { font-size: 0.9rem; margin-bottom: 0.75rem; display: block; }
.ws-footer { border-top: 2px solid var(--pane-border); margin-top: 2.5rem; padding-top: 1.25rem; display: flex; flex-wrap: wrap; gap: 2rem; }
.ws-footer section > h2 { font-size: 0.95rem; margin: 0 0 0.4rem; }
.ws-footer section ul { margin: 0; padding-left: 1.25rem; }
.ws-footer section li { font-size: 0.9rem; margin: 0.25rem 0; }
#ws-raw { margin-top: 2rem; font-size: 0.75rem; color: var(--muted); }
#ws-raw summary { cursor: pointer; font-size: 0.85rem; }
#ws-raw pre { white-space: pre-wrap; word-break: break-all; overflow: auto; max-height: 60vh; background: var(--pane-bg); border: 1px solid var(--pane-border); padding: 0.75rem; border-radius: 4px; }
</style>`;

// ---------------------------------------------------------------------------
// Page builder — emits JSON island + thin shell
// ---------------------------------------------------------------------------

function buildIslandPage(
  title: string,
  description: string,
  jsonData: object,
): string {
  const base = makeHtmlBase(title, description);
  const jsonText = JSON.stringify(jsonData);

  return [
    ...base.topOfHead,
    `</style>`,
    // JS detection: runs before first paint, adds class "js" to <html>
    `<script>document.documentElement.classList.add('js');</script>`,
    PAGE_CSS,
    `</head>`,
    `<body>`,
    // Client renderer target (empty until JS renders into it)
    `<div id="ws-render"></div>`,
    // No-JS fallback: raw JSON in a collapsible block
    `<details id="ws-raw">`,
    `<summary>Word data (raw JSON — enable JavaScript for full display)</summary>`,
    `<pre id="ws-data">${esc(jsonText)}</pre>`,
    `</details>`,
    // Scripts — app shell first (topbar/nav), then word page renderer
    APP_SHELL_TAG,
    WORD_PAGE_TAG,
    `</body>`,
    `</html>`,
  ].join('\n');
}

function renderRedirectPage(target: string): string {
  const safeTarget = `https://words.servewell.net/${encodeURIComponent(target)}`;
  return [
    `<!DOCTYPE html><html lang="en"><head>`,
    `<meta charset="UTF-8">`,
    `<meta http-equiv="refresh" content="0;url=${esc(safeTarget)}">`,
    `<title>Redirecting to ${esc(target)}</title>`,
    `</head><body>`,
    `<p>Redirecting to <a href="${esc(safeTarget)}">${esc(target)}</a>&hellip;</p>`,
    `</body></html>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------


if (!fs.existsSync(IN_DIR)) {
  console.error(`Input directory not found: ${IN_DIR}`);
  console.error('Run "npm run p2-words" first.');
  process.exit(1);
}

if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const jsonFiles = fs.readdirSync(IN_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .sort();

let written = 0;
let mainCount = 0;
let overflowCount = 0;
let redirectCount = 0;

for (const jsonFile of jsonFiles) {
  const baseName = jsonFile.replace(/\.json$/, '');
  const raw = JSON.parse(fs.readFileSync(path.join(IN_DIR, jsonFile), 'utf8'));

  let html: string;
  if ((raw as OverflowFile).type === 'overflow') {
    const d = raw as OverflowFile;
    const meta = d.ancientWord._meta;
    const title = `${meta.wordKey} — ${d.label}`;
    html = buildIslandPage(title, `Word study: ${title} (${meta.lang}, ${meta.strongsId})`, d);
    overflowCount++;
  } else if ((raw as RedirectFile)._redirect) {
    html = renderRedirectPage((raw as RedirectFile)._redirect);
    redirectCount++;
  } else {
    const d = raw as MainWordFile;
    const meta = d.ancientWord._meta;
    const suffix = meta.fileNumber > 1 ? ` (${meta.fileNumber})` : '';
    const title = meta.rootTranslation
      ? `${meta.rootTranslation}${suffix}`
      : `${meta.wordKey}${suffix}`;
    html = buildIslandPage(title, `Ancient word study: ${title} (${meta.lang}, ${meta.strongsId})`, d);
    mainCount++;
  }

  fs.writeFileSync(path.join(OUT_DIR, `${baseName}.html`), html, 'utf8');
  written++;
}

console.log(`Wrote ${written} word HTML files to dist/words/`);
console.log(`  ${mainCount} main word pages, ${overflowCount} overflow pages, ${redirectCount} redirects`);

// ---------------------------------------------------------------------------
// Copy a small set of diverse sample pages into public/test-r2/ so they are
// served by wrangler dev and visible in the visual-test-preview.html slides.
// ---------------------------------------------------------------------------
const TEST_R2_SAMPLES = ['aaron', 'love', 'grace', 'create'];
const TEST_R2_DIR = path.join(ROOT, 'public/test-r2');
if (fs.existsSync(TEST_R2_DIR)) fs.rmSync(TEST_R2_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_R2_DIR, { recursive: true });
let samplesCopied = 0;
for (const name of TEST_R2_SAMPLES) {
  const src = path.join(OUT_DIR, `${name}.html`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(TEST_R2_DIR, `${name}.html`));
    samplesCopied++;
  }
}
console.log(`Copied ${samplesCopied} sample pages to public/test-r2/ for visual preview`);

// ---------------------------------------------------------------------------
// Render fingerprint: covers the script tags embedded in word pages.
// Changing the tag URLs will invalidate the fingerprint and trigger a
// pre-deploy R2 sync warning.
// ---------------------------------------------------------------------------
{
  const renderFingerprint = `${APP_SHELL_TAG.length}:${WORD_PAGE_TAG.length}`;
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, '.words-render-fingerprint'), renderFingerprint, 'utf8');
}

