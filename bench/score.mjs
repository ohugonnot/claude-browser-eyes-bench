// Turns the generic findings of audit/audit.js plus the runner's events into
// defect ids, by kind of finding only (no selector, no DEFECTS.md).
export function detect(vp) {
  const f = vp.findings, e = vp.events, ids = [];
  if (f.overflowX.length) ids.push('D1');
  if (f.clipped.length) ids.push('D2');
  if (f.closeTargets.length) ids.push('D3');
  if (f.vhRules.length) ids.push('D4');
  if (f.unsupportedCss.length) ids.push('D5');
  if (e.pageErrors.length) ids.push('D6');
  if (e.httpErrors.length || e.requestsFailed.length) ids.push('D7');
  if (f.imgNoAlt.length || f.lowContrast.length) ids.push('D8');
  return ids;
}

// Every raw finding, whatever its kind: the fixed page must have none.
export function countFindings(vp) {
  const f = vp.findings, e = vp.events;
  return f.overflowX.length + f.clipped.length + f.smallTargets.length + f.closeTargets.length + f.imgNoAlt.length
    + f.lowContrast.length + f.vhRules.length + f.unsupportedCss.length
    + e.console.length + e.pageErrors.length + e.httpErrors.length + e.requestsFailed.length;
}
