import { detect } from './score.mjs';

export const VIEWPORTS = ['mobile', 'tablet', 'desktop'];
export const ENGINES = ['chromium', 'firefox', 'webkit'];

// expected.json: { engines: { <engine>: { <defect id>: [viewports where it must be detected] } } }
// Returns a list of human-readable mismatches (empty = identical).
export function compareToExpected(report, expected) {
  const problems = [];
  for (const engine of ENGINES) {
    const want = expected.engines?.[engine];
    if (!want) { problems.push(`${engine}: no entry in expected.json`); continue; }
    const got = {};
    for (const vp of VIEWPORTS) {
      const r = report.targets?.site?.engines?.[engine]?.viewports?.[vp];
      if (!r) { problems.push(`${engine}/${vp}: missing from report`); continue; }
      for (const id of detect(r)) (got[id] ||= []).push(vp);
    }
    for (const id of new Set([...Object.keys(want), ...Object.keys(got)])) {
      const w = [...(want[id] || [])].sort().join(',');
      const g = [...(got[id] || [])].sort().join(',');
      if (w !== g) problems.push(`${engine} ${id}: expected [${w}] got [${g}]`);
    }
  }
  return problems;
}
