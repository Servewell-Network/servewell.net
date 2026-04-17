/**
 * dev-server.mjs
 * Minimal static file server for local preview of public/ without wrangler.
 * Strips .html extensions — /words/aaron serves public/words/aaron.html
 *
 * Usage: node scripts/dev-server.mjs [port]
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = parseInt(process.argv[2] || '8080', 10);
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath.endsWith('/')) urlPath += 'index';

  // Resolve to absolute path and ensure it stays within public/
  const filePath = path.resolve(PUBLIC, '.' + urlPath);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // Try the path as-is, then with .html
  const candidates = [filePath, filePath + '.html'];
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile()) continue;
      const data = fs.readFileSync(candidate);
      const ext = path.extname(candidate);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
      return;
    } catch { /* try next */ }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(`404 Not found: ${urlPath}`);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving public/ at http://localhost:${PORT}`);
  console.log(`  Try: http://localhost:${PORT}/words/aaron`);
  console.log(`  Try: http://localhost:${PORT}/words/see`);
  console.log('Press Ctrl+C to stop.');
});
