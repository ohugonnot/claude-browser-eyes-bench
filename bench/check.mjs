// Pass/fail gate. Reads out/report.json (written by run.mjs) and exits non-zero unless:
//   1. site/ yields exactly the defects of bench/expected.json, per engine and viewport;
//   2. site-fixed/ yields no finding at all (every engine, every viewport);
//   3. site-fixed/ is exactly site/ plus the documented patches (bench/make-fixed.mjs);
//   4. the report covers every engine and viewport with the pinned Playwright version.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareToExpected, ENGINES, VIEWPORTS } from './compare.mjs';
import { countFindings, detect } from './score.mjs';
import { driftFixed } from './make-fixed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const problems = [];

let report;
try { report = read('out/report.json'); } catch { console.error('FAIL: out/report.json not found; run bench/run.mjs first'); process.exit(1); }
const expected = read('bench/expected.json');
const pinned = read('package.json').dependencies.playwright;

if (report.playwright !== pinned || expected.playwright !== pinned) {
  problems.push(`Playwright version: package.json ${pinned}, report ${report.playwright}, expected.json ${expected.playwright}`);
}

problems.push(...compareToExpected(report, expected).map((p) => `site/ ${p}`));

for (const engine of ENGINES) {
  for (const vp of VIEWPORTS) {
    const r = report.targets?.['site-fixed']?.engines?.[engine]?.viewports?.[vp];
    if (!r) { problems.push(`site-fixed/ ${engine}/${vp}: missing from report`); continue; }
    const n = countFindings(r);
    if (n || detect(r).length) problems.push(`site-fixed/ ${engine}/${vp}: ${n} finding(s), ids [${detect(r).join(',')}]`);
  }
}

problems.push(...driftFixed().map((p) => `drift: ${p}`));

if (problems.length) {
  console.error(`FAIL (${problems.length})\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
const nSite = ENGINES.map((e) => new Set(VIEWPORTS.flatMap((v) => detect(report.targets.site.engines[e].viewports[v]))).size);
console.log(`OK: site/ ${ENGINES.map((e, i) => `${e} ${nSite[i]}`).join(', ')} defect ids as expected; site-fixed/ 0 findings on ${ENGINES.length} engines x ${VIEWPORTS.length} viewports`);
