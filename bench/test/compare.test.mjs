import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, ENGINES, VIEWPORTS } from '../compare.mjs';
import { SIGNALS } from '../score.mjs';

const empty = () => ({
  findings: { overflowX: [], clipped: [], smallTargets: [], closeTargets: [], imgNoAlt: [], lowContrast: [], vhRules: [], unsupportedCss: [], notes: [] },
  events: { console: [], pageErrors: [], httpErrors: [], requestsFailed: [] },
  clicks: { total: 4, fallback: 0 }, blocked: [],
});
const report = (fill) => {
  const targets = {};
  for (const t of ['site', 'site-fixed', 'canary']) {
    targets[t] = { engines: {} };
    for (const e of ENGINES) {
      targets[t].engines[e] = { viewports: {} };
      for (const v of t === 'canary' ? ['desktop'] : VIEWPORTS) targets[t].engines[e].viewports[v] = fill(t, e, v);
    }
  }
  return { targets };
};
const expectedNothing = () => ({ engines: Object.fromEntries(ENGINES.map((e) => [e, { defects: {}, signals: {}, canary: [] }])) });

test('an empty report matches an empty expectation, except the canary guard', () => {
  const p = verdict(report(empty), expectedNothing());
  assert.ok(p.every((x) => x.startsWith('canary') && x.includes('offline guard')), p.join('\n'));
});

test('every signal found on site-fixed is a problem', () => {
  const mk = (sig, add) => report((t) => { const r = empty(); if (t === 'site-fixed') add(r); r.blocked = t === 'canary' ? ['x'] : []; return r; });
  const adders = {
    overflowX: (r) => r.findings.overflowX.push('a'), clipped: (r) => r.findings.clipped.push('a'),
    smallTargets: (r) => r.findings.smallTargets.push('a'), closeTargets: (r) => r.findings.closeTargets.push('a'),
    imgNoAlt: (r) => r.findings.imgNoAlt.push('a'), lowContrast: (r) => r.findings.lowContrast.push('a'),
    vhRules: (r) => r.findings.vhRules.push('a'), unsupportedCss: (r) => r.findings.unsupportedCss.push('a'),
    pageErrors: (r) => r.events.pageErrors.push('a'), httpErrors: (r) => r.events.httpErrors.push('a'),
    requestsFailed: (r) => r.events.requestsFailed.push('a'), console: (r) => r.events.console.push('a'),
  };
  assert.deepEqual(Object.keys(adders).sort(), [...SIGNALS].sort());
  for (const [s, add] of Object.entries(adders)) {
    assert.ok(verdict(mk(s, add), expectedNothing()).some((x) => x.startsWith('site-fixed/')), `${s} not caught`);
  }
});

test('a click fallback on site-fixed and an unexpected one on site both fail', () => {
  const blocked = (r, t) => { r.blocked = t === 'canary' ? ['x'] : []; return r; };
  let p = verdict(report((t, e, v) => { const r = empty(); if (t === 'site-fixed') r.clicks.fallback = 1; return blocked(r, t); }), expectedNothing());
  assert.ok(p.some((x) => x.includes('not clickable')));
  p = verdict(report((t, e, v) => { const r = empty(); if (t === 'site' && v === 'mobile') r.clicks.fallback = 1; return blocked(r, t); }), expectedNothing());
  assert.ok(p.some((x) => x.includes('click fallback')));
});
