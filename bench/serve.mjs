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
    const reply = (code, body) => { if (!res.headersSent) res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' }); res.end(body); };
    try {
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return reply(400, 'bad request'); }
      if (rel.includes('\0')) return reply(400, 'bad request');
      const file = path.join(base, rel.endsWith('/') ? rel + 'index.html' : rel);
      if (file !== base && !file.startsWith(base + path.sep)) return reply(400, 'bad request');
      fs.readFile(file, (err, data) => {
        if (err) return reply(404, 'not found');
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
      });
    } catch {
      reply(400, 'bad request');
    }
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
