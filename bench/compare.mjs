import { detect, signals, countFindings, SIGNALS } from './score.mjs';

export const VIEWPORTS = ['mobile', 'tablet', 'desktop'];
export const ENGINES = ['chromium', 'firefox', 'webkit'];

const key = (list) => [...list].sort().join(',');

// expected.json, per engine:
//   defects        { id: [viewports] }       what site/ must be detected as
//   signals        { signal: [viewports] }   every raw signal site/ must show (and no other)
//   clickFallbacks { viewport: n }           real clicks that timed out on site/ (default 0)
//   canary         [signals]                 what bench/canary/ must show at desktop
// Returns a list of readable problems (empty = all good).
export function verdict(report, expected) {
  const problems = [];
  const vpOf = (target, engine, vp) => report.targets?.[target]?.engines?.[engine]?.viewports?.[vp];

  for (const engine of ENGINES) {
    const want = expected.engines?.[engine];
    if (!want) { problems.push(`${engine}: no entry in expected.json`); continue; }

    // site/: defect ids, raw signals, click fallbacks, audit notes, blocked requests
    const gotIds = {}, gotSig = {};
    for (const vp of VIEWPORTS) {
      const r = vpOf('site', engine, vp);
      if (!r) { problems.push(`site/ ${engine}/${vp}: missing from report`); continue; }
      for (const id of detect(r)) (gotIds[id] ||= []).push(vp);
      for (const s of signals(r)) (gotSig[s] ||= []).push(vp);
      const wantFb = want.clickFallbacks?.[vp] || 0;
      if (r.clicks.fallback !== wantFb) problems.push(`site/ ${engine}/${vp}: ${r.clicks.fallback} click fallback(s), expected ${wantFb}`);
      if (r.findings.notes.length) problems.push(`site/ ${engine}/${vp}: audit could not read something: ${r.findings.notes.join('; ')}`);
      if (r.blocked.length) problems.push(`site/ ${engine}/${vp}: request(s) outside localhost attempted: ${r.blocked.join(', ')}`);
    }
    for (const id of new Set([...Object.keys(want.defects || {}), ...Object.keys(gotIds)])) {
      const w = key(want.defects?.[id] || []), g = key(gotIds[id] || []);
      if (w !== g) problems.push(`site/ ${engine} ${id}: expected [${w}] got [${g}]`);
    }
    for (const s of new Set([...Object.keys(want.signals || {}), ...Object.keys(gotSig)])) {
      if (!SIGNALS.includes(s)) { problems.push(`${engine}: unknown signal "${s}" in expected.json`); continue; }
      const w = key(want.signals?.[s] || []), g = key(gotSig[s] || []);
      if (w !== g) problems.push(`site/ ${engine} signal ${s}: expected [${w}] got [${g}]`);
    }

    // site-fixed/: nothing at all
    for (const vp of VIEWPORTS) {
      const r = vpOf('site-fixed', engine, vp);
      if (!r) { problems.push(`site-fixed/ ${engine}/${vp}: missing from report`); continue; }
      const n = countFindings(r);
      if (n) problems.push(`site-fixed/ ${engine}/${vp}: ${n} finding(s) [${signals(r).join(',')}]`);
      if (r.clicks.fallback) problems.push(`site-fixed/ ${engine}/${vp}: ${r.clicks.fallback} button(s) not clickable (fallback used)`);
      if (r.findings.notes.length) problems.push(`site-fixed/ ${engine}/${vp}: audit could not read something: ${r.findings.notes.join('; ')}`);
      if (r.blocked.length) problems.push(`site-fixed/ ${engine}/${vp}: request(s) outside localhost attempted: ${r.blocked.join(', ')}`);
    }

    // canary: a page that shows every signal, so each detector is proven alive
    const c = vpOf('canary', engine, 'desktop');
    if (!c) { problems.push(`canary ${engine}: missing from report`); continue; }
    const have = new Set(signals(c));
    for (const s of want.canary || []) if (!have.has(s)) problems.push(`canary ${engine}: signal ${s} not detected`);
    for (const s of have) if (!(want.canary || []).includes(s)) problems.push(`canary ${engine}: unexpected signal ${s}`);
    if (!c.blocked.length) problems.push(`canary ${engine}: the outside request was not blocked (offline guard not working)`);
  }
  return problems;
}
