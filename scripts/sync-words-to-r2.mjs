#!/usr/bin/env node
/**
 * sync-words-to-r2.mjs
 *
 * Uploads public/words/ to the Cloudflare R2 bucket that backs words.servewell.net.
 * The bucket uses an R2 custom domain (attached directly in the Cloudflare dashboard),
 * so no Worker is involved — files are served straight from R2.
 *
 * Files are uploaded WITHOUT the .html extension so that
 *   words.servewell.net/aaron  →  R2 key "aaron"  (Content-Type: text/html)
 * Redirect stubs (which wrap a meta-refresh tag) are uploaded the same way.
 *
 * Run this after `npm run p2-words-html` whenever word pages change.
 *
 * One-time setup (do this once in the Cloudflare dashboard):
 *   1. Create the bucket: npx wrangler r2 bucket create servewell-words
 *   2. Attach custom domain: R2 → servewell-words → Settings → Custom Domains → Add
 *      Domain: words.servewell.net  (Cloudflare handles the DNS record automatically)
 *
 * Required environment variables:
 *   CLOUDFLARE_ACCOUNT_ID   — your Cloudflare account ID
 *   R2_ACCESS_KEY_ID        — R2 API token access key ID
 *   R2_SECRET_ACCESS_KEY    — R2 API token secret access key
 *
 *   Create R2 API tokens at: Cloudflare dashboard → R2 → Manage R2 API Tokens
 *   Never commit these values; use a local .env file or shell exports.
 *
 * Optional:
 *   R2_BUCKET_NAME   — defaults to "servewell-words"
 *   R2_CONCURRENCY   — parallel uploads, defaults to 20
 *
 * Run: npm run deploy:words-r2
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '..');

// Load .env from repo root if present (values already in environment take precedence)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}
const WORDS_DIR = join(ROOT, 'dist/words');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME ?? 'servewell-words';
const CONCURRENCY = Math.max(1, parseInt(process.env.R2_CONCURRENCY ?? '20', 10));

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('Missing required environment variables:');
  if (!ACCOUNT_ID) console.error('  CLOUDFLARE_ACCOUNT_ID');
  if (!ACCESS_KEY_ID) console.error('  R2_ACCESS_KEY_ID');
  if (!SECRET_ACCESS_KEY) console.error('  R2_SECRET_ACCESS_KEY');
  console.error('\nCreate an R2 API token at:');
  console.error('  https://dash.cloudflare.com/?to=/:account/r2/api-tokens');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

function walkDir(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkDir(full));
    else result.push(full);
  }
  return result;
}

const allFiles = walkDir(WORDS_DIR);
console.log(`Uploading ${allFiles.length} files → R2 bucket "${BUCKET}"...`);
const start = Date.now();

let uploaded = 0;
let failed = 0;
const queue = [...allFiles];

async function uploadFile(filePath) {
  const rawKey = relative(WORDS_DIR, filePath);
  // Strip .html extension so URLs are clean: words.servewell.net/aaron (not /aaron.html).
  // R2 custom domain serves keys directly, so the key IS the URL path.
  // .json files keep their extension: words.servewell.net/love.json
  const isHtml = rawKey.endsWith('.html');
  const isJson = rawKey.endsWith('.json');
  const key = isHtml ? rawKey.slice(0, -5) : rawKey;
  const contentType = isJson ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8';
  const body = readFileSync(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
  }));
  uploaded++;
  if (uploaded % 1000 === 0) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ${uploaded}/${allFiles.length} uploaded (${elapsed}s)...`);
  }
}

async function worker() {
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file) break;
    try {
      await uploadFile(file);
    } catch (err) {
      console.error(`  FAILED: ${relative(WORDS_DIR, file)} — ${err.message}`);
      failed++;
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
if (failed > 0) {
  console.error(`\nCompleted in ${elapsed}s with errors: ${uploaded} uploaded, ${failed} failed.`);
  process.exit(1);
} else {
  console.log(`\nDone: ${uploaded} files uploaded to R2 in ${elapsed}s.`);
  // Record the current render fingerprint so pre-deploy knows R2 is in sync.
  const fingerprintFile = join(ROOT, 'dist', '.words-render-fingerprint');
  const syncedFile = join(ROOT, 'dist', '.words-r2-synced');
  const fingerprint = existsSync(fingerprintFile) ? readFileSync(fingerprintFile, 'utf8') : '';
  writeFileSync(syncedFile, fingerprint, 'utf8');
}
