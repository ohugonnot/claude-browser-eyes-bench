// Hash of everything a report depends on, so that check.mjs can refuse a report
// produced from other files than the ones now on disk.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PATHS = ['audit/audit.js', 'bench/run.mjs', 'bench/score.mjs', 'site', 'site-fixed', 'bench/canary'];

function files(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return [p];
  return fs.readdirSync(p).sort().flatMap((n) => files(path.join(p, n)));
}

export function inputsHash(root) {
  const h = crypto.createHash('sha256');
  for (const rel of PATHS) {
    for (const f of files(path.join(root, rel))) {
      h.update(path.relative(root, f).split(path.sep).join('/') + '\0');
      h.update(fs.readFileSync(f));
      h.update('\0');
    }
  }
  return h.digest('hex');
}
