import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');

// Raw HTTP so that odd paths are sent exactly as written.
function raw(port, target) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(`GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
    let data = '';
    s.on('data', (d) => { data += d; });
    s.on('end', () => resolve(Number(data.split(' ')[1])));
    s.on('error', reject);
  });
}

test('static server answers and survives hostile paths', async () => {
  const srv = await startServer(SITE);
  try {
    assert.equal(await raw(srv.port, '/'), 200);
    assert.equal(await raw(srv.port, '/css/style.css'), 200);
    assert.equal(await raw(srv.port, '/missing.json'), 404);
    assert.equal(await raw(srv.port, '/css'), 404);
    assert.equal(await raw(srv.port, '/css/style.css%00.html'), 400);
    assert.ok([400, 404].includes(await raw(srv.port, '/%2e%2e/package.json')), 'traversal refused');
    assert.ok([400, 404].includes(await raw(srv.port, '/..%2f..%2fpackage.json')), 'traversal refused');
    assert.equal(await raw(srv.port, '/%zz'), 400);
    assert.equal(await raw(srv.port, '/'), 200, 'still alive after the hostile requests');
  } finally {
    await srv.close();
  }
});
