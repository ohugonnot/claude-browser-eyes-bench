// Raw signals first, defect ids second. A signal is one kind of finding of the
// audit or one kind of event of the runner; a defect id is derived from them.
export const SIGNALS = ['overflowX', 'clipped', 'smallTargets', 'closeTargets', 'imgNoAlt', 'lowContrast',
  'vhRules', 'unsupportedCss', 'pageErrors', 'httpErrors', 'requestsFailed', 'console'];

// Number of findings per signal for one viewport report.
export function counts(vp) {
  const f = vp.findings, e = vp.events;
  return {
    overflowX: f.overflowX.length, clipped: f.clipped.length, smallTargets: f.smallTargets.length,
    closeTargets: f.closeTargets.length, imgNoAlt: f.imgNoAlt.length, lowContrast: f.lowContrast.length,
    vhRules: f.vhRules.length, unsupportedCss: f.unsupportedCss.length,
    pageErrors: e.pageErrors.length, httpErrors: e.httpErrors.length, requestsFailed: e.requestsFailed.length,
    console: e.console.length,
  };
}

// Names of the signals present in a viewport report.
export function signals(vp) {
  const c = counts(vp);
  return SIGNALS.filter((s) => c[s] > 0);
}

// Defect ids, by kind of finding only (no selector, no DEFECTS.md).
export function detect(vp) {
  const c = counts(vp), ids = [];
  if (c.overflowX) ids.push('D1');
  if (c.clipped) ids.push('D2');
  if (c.closeTargets) ids.push('D3');
  if (c.vhRules) ids.push('D4');
  if (c.unsupportedCss) ids.push('D5');
  if (c.pageErrors) ids.push('D6');
  if (c.httpErrors || c.requestsFailed) ids.push('D7');
  if (c.imgNoAlt || c.lowContrast) ids.push('D8');
  return ids;
}

// Every raw finding, whatever its kind: the fixed page must have none.
export function countFindings(vp) {
  return Object.values(counts(vp)).reduce((a, b) => a + b, 0);
}
