// Generic page audit, meant to be injected into a page (page.evaluate, an MCP
// "evaluate" tool, a DevTools console...). It is a single async arrow function
// expression that returns a JSON-serialisable object. It knows nothing about
// the defects of this repository: it checks generic properties only.
//
// Detected by RENDERING (measured on the live page, per viewport and engine):
//   overflowX, clipped, smallTargets, closeTargets, imgNoAlt, lowContrast
// Detected by STATIC HEURISTIC (read from the stylesheet text, not from layout):
//   vhRules          rules whose height / min-height / max-height uses a `vh` unit
//   unsupportedCss   declarations the running engine rejects, for ONE feature
//                    only: `calc-size()` (CSS.supports is the engine's own
//                    answer; the stylesheet text is read because a rejected
//                    declaration is dropped from the CSSOM). Adding another
//                    feature means adding it to FEATURES below.
// Not done here: console errors and failed requests. They are events, not DOM
// state; the runner (bench/run.mjs) collects them with Playwright listeners.
// `notes` lists what the audit could not read (unreadable or unfetchable
// stylesheet): an empty `notes` means nothing was silently skipped.
async () => {
  const out = { notes: [] };
  const label = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].join('.') : '');

  // Layout width. With touch emulation Chromium can widen the layout viewport
  // to fit overflowing content (innerWidth > screen.width), so on coarse
  // pointers the screen width is the reference.
  const coarse = matchMedia('(pointer:coarse)').matches;
  const W = coarse ? Math.min(innerWidth, screen.width || innerWidth) : innerWidth;
  out.viewport = { w: W, innerW: innerWidth, screenW: screen.width, h: innerHeight, dpr: devicePixelRatio, scrollW: document.documentElement.scrollWidth };

  // Horizontal overflow (rendered)
  out.overflowX = document.documentElement.scrollWidth > W + 1
    ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > W + 1).slice(0, 5).map(label)
    : [];

  // Touch targets under 44 px, and small targets less than 8 px from another one (rendered)
  const targets = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const size = (e) => { const r = e.getBoundingClientRect(); return { el: label(e), w: Math.round(r.width), h: Math.round(r.height) }; };
  out.smallTargets = targets.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(size);
  out.closeTargets = [];
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i].getBoundingClientRect(), b = targets[j].getBoundingClientRect();
      const dx = Math.max(0, a.left - b.right, b.left - a.right), dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
      const gap = Math.hypot(dx, dy);
      if (gap < 8 && (a.height < 44 || b.height < 44)) out.closeTargets.push([label(targets[i]), label(targets[j]), Math.round(gap)]);
    }
  }

  // <img> without an alt attribute (DOM)
  out.imgNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src'));

  // Text contrast under 4.5:1 (rendered colours; backgrounds resolved by walking up the ancestors)
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bg = (e) => { while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  out.lowContrast = [];
  for (const e of document.querySelectorAll('body *')) {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const fg = parse(getComputedStyle(e).color);
    if (!fg) continue;
    const l1 = lum(fg), l2 = lum(bg(e));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) out.lowContrast.push({ el: label(e), ratio: +ratio.toFixed(2) });
  }

  // Content cut by overflow:hidden (rendered)
  out.clipped = [...document.querySelectorAll('body *')].filter((e) => {
    const s = getComputedStyle(e);
    return (s.overflow === 'hidden' || s.overflowY === 'hidden') && e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1;
  }).map((e) => label(e) + ' ' + e.scrollHeight + '>' + e.clientHeight);

  // STATIC: `vh` heights in the CSSOM (including @import-ed sheets). Not a
  // rendering check: in a headless engine 100vh equals innerHeight, so the
  // layout looks fine. It will also flag harmless uses of vh.
  out.vhRules = [];
  const sheets = [];
  const collect = (ss) => {
    if (sheets.includes(ss)) return;
    sheets.push(ss);
    let rules;
    try { rules = [...ss.cssRules]; } catch (e) { out.notes.push('unreadable stylesheet: ' + (ss.href || 'inline')); return; }
    rules.forEach(walk);
  };
  const walk = (rule) => {
    if (rule.styleSheet) collect(rule.styleSheet); // @import
    if (rule.style && /(^|[^a-z0-9.])\d*\.?\d+[l]?vh\b/.test(rule.style.height + ' ' + rule.style.minHeight + ' ' + rule.style.maxHeight)) {
      out.vhRules.push(rule.selectorText + ' {' + (rule.style.height || rule.style.minHeight || rule.style.maxHeight) + '}');
    }
    if (rule.cssRules) [...rule.cssRules].forEach(walk);
  };
  for (const ss of document.styleSheets) collect(ss);

  // STATIC + engine answer: declarations using a feature the running engine
  // does not support. The declaration must end with `;`, `}` or `!` so that a
  // `@supports (height: calc-size(...))` guard is not taken for a use.
  const FEATURES = [/([a-z-]+)\s*:\s*(calc-size\((?:[^()]|\([^()]*\))*\))\s*(?=[;}!]|$)/g];
  out.unsupportedCss = [];
  for (const ss of sheets) {
    let text = '';
    try { text = ss.href ? await (await fetch(ss.href)).text() : (ss.ownerNode ? ss.ownerNode.textContent : ''); } catch (e) { out.notes.push('stylesheet text not read: ' + (ss.href || 'inline')); continue; }
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const re of FEATURES) {
      for (const m of text.matchAll(re)) if (!CSS.supports(m[1], m[2])) out.unsupportedCss.push(m[1] + ': ' + m[2]);
    }
  }
  return out;
}
