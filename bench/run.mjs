// Runs audit/audit.js on site/ and site-fixed/ in chromium, firefox and webkit
// at three viewports. Writes out/report.json and out/*.png, then compares the
// result with bench/expected.json. Does not read DEFECTS.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, devices } from 'playwright';
import { startServer } from './serve.mjs';
import { detect } from './score.mjs';
import { compareToExpected, ENGINES, VIEWPORTS } from './compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const AUDIT = fs.readFileSync(path.join(ROOT, 'audit', 'audit.js'), 'utf8');
const LAUNCHERS = { chromium, firefox, webkit };
const SIZES = { mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 900 } };
const DESKTOP = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };

function contextOptions(engine, vp) {
  const d = vp === 'mobile' ? devices['iPhone 15'] : vp === 'tablet' ? devices['iPad (gen 7)'] : devices[DESKTOP[engine]];
  const o = { ...d, viewport: SIZES[vp], screen: SIZES[vp] };
  if (vp === 'desktop') o.deviceScaleFactor = 1;
  delete o.defaultBrowserType;
  if (engine === 'firefox') delete o.isMobile; // not supported by Firefox
  return o;
}

async function auditViewport(browser, engine, vp, url, shot) {
  const ctx = await browser.newContext(contextOptions(engine, vp));
  const page = await ctx.newPage();
  const events = { console: [], pageErrors: [], httpErrors: [], requestsFailed: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') events.console.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => events.pageErrors.push(String(e.message || e)));
  page.on('response', (r) => { if (r.status() >= 400) events.httpErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('requestfailed', (r) => events.requestsFailed.push(new URL(r.url()).pathname));
  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({ path: shot, fullPage: true });
  const findings = await page.evaluate(`(${AUDIT})()`);
  // Press every button, as a user would. When a real click times out (it can
  // under Chromium touch emulation on an overflowing page) fall back to a
  // dispatched click event and record it.
  const clicks = { total: 0, fallback: 0 };
  const n = await page.locator('button').count();
  for (let i = 0; i < n; i++) {
    clicks.total++;
    try { await page.locator('button').nth(i).click({ timeout: 3000 }); } catch {
      clicks.fallback++;
      await page.locator('button').nth(i).dispatchEvent('click');
    }
  }
  await page.waitForTimeout(200);
  await ctx.close();
  return { findings, events, clicks, screenshot: path.relative(ROOT, shot) };
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.rmSync(path.join(OUT, f));

const servers = {
  site: await startServer(path.join(ROOT, 'site')),
  'site-fixed': await startServer(path.join(ROOT, 'site-fixed')),
};
const report = {
  playwright: JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version,
  node: process.version,
  generatedAt: new Date().toISOString(),
  targets: {},
};
try {
  for (const [target, srv] of Object.entries(servers)) {
    report.targets[target] = { engines: {} };
    for (const engine of ENGINES) {
      const t0 = Date.now();
      const browser = await LAUNCHERS[engine].launch();
      const entry = { version: browser.version(), launchMs: Date.now() - t0, viewports: {} };
      for (const vp of VIEWPORTS) {
        entry.viewports[vp] = await auditViewport(browser, engine, vp, `http://127.0.0.1:${srv.port}/`, path.join(OUT, `${target}-${engine}-${vp}.png`));
      }
      await browser.close();
      entry.totalMs = Date.now() - t0;
      report.targets[target].engines[engine] = entry;
      const ids = [...new Set(VIEWPORTS.flatMap((vp) => detect(entry.viewports[vp])))].sort();
      console.log(`${target.padEnd(10)} ${engine.padEnd(8)} ${String(entry.version).padEnd(14)} ${String(entry.totalMs).padStart(6)} ms  ${ids.length} defect id(s): ${ids.join(' ') || '-'}`);
    }
  }
} finally {
  await Promise.all(Object.values(servers).map((s) => s.close()));
}

const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench', 'expected.json'), 'utf8'));
report.comparison = { mismatches: compareToExpected(report, expected) };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(report.comparison.mismatches.length ? `vs expected.json: ${report.comparison.mismatches.length} mismatch(es)` : 'vs expected.json: identical');

