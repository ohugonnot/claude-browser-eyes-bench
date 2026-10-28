// Runs audit/audit.js on site/, site-fixed/ and bench/canary/ in chromium,
// firefox and webkit. site/ and site-fixed/ at three viewports, the canary at
// desktop only. Writes out/report.json and out/*.png, then compares the result
// with bench/expected.json. Does not read DEFECTS.md. Any request to a host
// other than localhost is aborted and recorded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, devices } from 'playwright';
import { startServer } from './serve.mjs';
import { detect } from './score.mjs';
import { verdict, ENGINES, VIEWPORTS } from './compare.mjs';
import { inputsHash } from './inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const AUDIT = fs.readFileSync(path.join(ROOT, 'audit', 'audit.js'), 'utf8');
const LAUNCHERS = { chromium, firefox, webkit };
const SIZES = { mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 900 } };
const DESKTOP = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };
const TARGETS = [
  { name: 'site', dir: 'site', viewports: VIEWPORTS },
  { name: 'site-fixed', dir: 'site-fixed', viewports: VIEWPORTS },
  { name: 'canary', dir: 'bench/canary', viewports: ['desktop'] },
];

const isLocal = (host) => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host);

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
  // Offline guard: nothing may leave localhost. Attempts are aborted and recorded.
  const blocked = [];
  await ctx.route((u) => /^(https?|wss?):$/.test(u.protocol) && !isLocal(u.hostname), (route) => {
    blocked.push(new URL(route.request().url()).host);
    return route.abort();
  });
  const page = await ctx.newPage();
  const events = { console: [], pageErrors: [], httpErrors: [], requestsFailed: [] };
  const local = (u) => { try { return isLocal(new URL(u).hostname); } catch { return false; } };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') events.console.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => events.pageErrors.push(String(e.message || e)));
  page.on('response', (r) => { if (r.status() >= 400) events.httpErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('requestfailed', (r) => { if (local(r.url())) events.requestsFailed.push(new URL(r.url()).pathname); });
  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({ path: shot, fullPage: true });
  const findings = await page.evaluate(`(${AUDIT}\n)()`);
  // Press every button, as a user would. A real click that times out (it can
  // under Chromium touch emulation on an overflowing page) falls back to a
  // dispatched click event; the fallback is counted and check.mjs judges it.
  const clicks = { total: 0, fallback: 0 };
  const n = await page.locator('button').count();
  for (let i = 0; i < n; i++) {
    clicks.total++;
    try { await page.locator('button').nth(i).click({ timeout: 3000 }); } catch (e) {
      if (e.name !== 'TimeoutError') throw e;
      clicks.fallback++;
      await page.locator('button').nth(i).dispatchEvent('click');
    }
  }
  await page.waitForTimeout(200);
  await ctx.close();
  return { findings, events, clicks, blocked: [...new Set(blocked)], screenshot: path.relative(ROOT, shot) };
}

try {
  fs.mkdirSync(OUT, { recursive: true });
  fs.accessSync(OUT, fs.constants.W_OK);
} catch {
  console.error(`out/ is not writable by uid ${process.getuid?.()}. Create it yourself (mkdir out) or run with your ids:\n  BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm --build bench`);
  process.exit(1);
}
for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.rmSync(path.join(OUT, f));

const servers = {};
for (const t of TARGETS) servers[t.name] = await startServer(path.join(ROOT, t.dir));
const report = {
  playwright: JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version,
  node: process.version,
  generatedAt: new Date().toISOString(),
  inputsHash: inputsHash(ROOT),
  targets: {},
};
try {
  for (const t of TARGETS) {
    report.targets[t.name] = { engines: {} };
    for (const engine of ENGINES) {
      const t0 = Date.now();
      const browser = await LAUNCHERS[engine].launch();
      const entry = { version: browser.version(), launchMs: Date.now() - t0, viewports: {} };
      for (const vp of t.viewports) {
        entry.viewports[vp] = await auditViewport(browser, engine, vp, `http://127.0.0.1:${servers[t.name].port}/`, path.join(OUT, `${t.name}-${engine}-${vp}.png`));
      }
      await browser.close();
      entry.totalMs = Date.now() - t0;
      report.targets[t.name].engines[engine] = entry;
      const ids = [...new Set(t.viewports.flatMap((vp) => detect(entry.viewports[vp])))].sort();
      console.log(`${t.name.padEnd(10)} ${engine.padEnd(8)} ${String(entry.version).padEnd(14)} ${String(entry.totalMs).padStart(6)} ms  ${ids.length} defect id(s): ${ids.join(' ') || '-'}`);
    }
  }
} finally {
  await Promise.all(Object.values(servers).map((s) => s.close()));
}

const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench', 'expected.json'), 'utf8'));
report.comparison = { problems: verdict(report, expected) };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(report.comparison.problems.length ? `vs expected.json: ${report.comparison.problems.length} problem(s)` : 'vs expected.json: identical');
