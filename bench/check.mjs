// Pass/fail gate. Reads out/report.json (written by run.mjs) and exits non-zero unless:
//   1. the report was produced from the files now on disk (no stale report);
//   2. site/ yields exactly the expected defects AND exactly the expected raw
//      signals, per engine and viewport, with the expected click fallbacks;
//   3. site-fixed/ yields no finding of any kind and no click fallback;
//   4. the canary page (which shows every signal) is detected signal by signal,
//      and its request outside localhost was blocked;
//   5. the audit read every stylesheet (no notes) and nothing left localhost;
//   6. site-fixed/ is exactly site/ plus the documented patches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verdict, ENGINES, VIEWPORTS } from './compare.mjs';
import { detect } from './score.mjs';
import { driftFixed } from './make-fixed.mjs';
import { inputsHash } from './inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const problems = [];

let report;
try { report = read('out/report.json'); } catch { console.error('FAIL: out/report.json not found; run bench/run.mjs first'); process.exit(1); }
const expected = read('bench/expected.json');
const pinned = read('package.json').dependencies.playwright;

if (report.inputsHash !== inputsHash(ROOT)) problems.push('stale report: out/report.json was not produced from the current audit, runner, pages and canary (run bench/run.mjs again)');
if (report.playwright !== pinned || expected.playwright !== pinned) {
  problems.push(`Playwright version: package.json ${pinned}, report ${report.playwright}, expected.json ${expected.playwright}`);
}
problems.push(...verdict(report, expected));
problems.push(...driftFixed().map((p) => `drift: ${p}`));

if (problems.length) {
  console.error(`FAIL (${problems.length})\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
const nSite = ENGINES.map((e) => new Set(VIEWPORTS.flatMap((v) => detect(report.targets.site.engines[e].viewports[v]))).size);
console.log(`OK: site/ ${ENGINES.map((e, i) => `${e} ${nSite[i]}`).join(', ')} defect ids and all raw signals as expected; site-fixed/ 0 findings on ${ENGINES.length} engines x ${VIEWPORTS.length} viewports; canary detected; nothing left localhost`);
