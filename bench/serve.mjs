// Minimal static file server (no dependency). Used by the runner (random port,
// loopback) and by `docker compose up site` (fixed port).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

export function startServer(root, port = 0, host = '127.0.0.1') {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { rel = null; }
    const file = rel === null ? null : path.join(base, rel.endsWith('/') ? rel + 'index.html' : rel);
    if (!file || (file !== base && !file.startsWith(base + path.sep))) { res.writeHead(400).end('bad request'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root = 'site', port = '8099', host = '127.0.0.1'] = process.argv.slice(2);
  const s = await startServer(root, Number(port), host);
  console.log(`serving ${root} on http://${host}:${s.port}/`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => s.server.close(() => process.exit(0)));
}
