#!/usr/bin/env node
/**
 * cleanup-r2-json.mjs
 *
 * One-time script: deletes all .json keys from the servewell-words R2 bucket.
 * These were added when the search feature briefly used JSON files instead of
 * parsing the #ws-data island from the HTML pages.
 *
 * Run once: node scripts/cleanup-r2-json.mjs
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync, join as pathJoin } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '..');

// Load .env if present
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

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME ?? 'servewell-words';

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

// List all keys ending in .json
let continuationToken;
const keysToDelete = [];

console.log(`Scanning bucket "${BUCKET}" for .json keys...`);
do {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    ContinuationToken: continuationToken,
  }));
  for (const obj of res.Contents ?? []) {
    if (obj.Key?.endsWith('.json')) keysToDelete.push(obj.Key);
  }
  continuationToken = res.NextContinuationToken;
} while (continuationToken);

console.log(`Found ${keysToDelete.length} .json keys to delete.`);
if (keysToDelete.length === 0) { console.log('Nothing to do.'); process.exit(0); }

// Delete in batches of 1000 (S3 API limit)
let deleted = 0;
for (let i = 0; i < keysToDelete.length; i += 1000) {
  const batch = keysToDelete.slice(i, i + 1000).map(Key => ({ Key }));
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: batch },
  }));
  deleted += batch.length;
  console.log(`  Deleted ${deleted}/${keysToDelete.length}...`);
}

console.log(`Done. Deleted ${deleted} .json keys from R2.`);
