// Builds site-fixed/ from site/ by applying exactly one patch per defect.
// site-fixed/ is committed; `node bench/make-fixed.mjs --check` (run by
// check.mjs) fails if the committed copy differs from what these patches
// produce, so the gap between the two pages is exactly the list below.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Each patch: file, exact text to find (must occur once), replacement.
// Several patches may belong to the same defect.
export const PATCHES = [
  { defect: 'D1', file: 'css/style.css', from: '.grille-tarifs{width:600px;', to: '.grille-tarifs{max-width:600px;' },
  { defect: 'D2', file: 'css/style.css',
    from: '  .carte{position:relative;height:90px;overflow:hidden;padding-top:28px}\n  .carte-titre{position:absolute;top:4px;left:12px;right:12px;margin:0;font-size:1.1rem;line-height:1.1}\n',
    to: '' },
  { defect: 'D3', file: 'css/style.css',
    from: '.action-compacte{height:26px;padding:0 6px;font-size:12px;margin:0;',
    to: '.action-compacte{min-height:44px;min-width:44px;padding:0 12px;font-size:14px;margin:0 8px 0 0;' },
  { defect: 'D4', file: 'css/style.css',
    from: '.hero{position:relative;height:100vh;padding:24px 16px;',
    to: '.hero{display:flex;flex-direction:column;min-height:100dvh;padding:24px 16px calc(24px + env(safe-area-inset-bottom));' },
  { defect: 'D4', file: 'css/style.css',
    from: '.hero .cta{position:absolute;left:16px;right:16px;bottom:0;display:block;',
    to: '.hero .cta{margin-top:auto;display:block;' },
  { defect: 'D5', file: 'css/style.css', from: '.encart{height:40px;height:calc-size(auto, size + 24px);', to: '.encart{height:auto;' },
  { defect: 'D6', file: 'js/app.js',
    from: "document.getElementById('btn-calcul')",
    to: "function calculerTotal(a, b) {\n  return a + b;\n}\n\ndocument.getElementById('btn-calcul')" },
  { defect: 'D7', file: 'api/promotions.json', create: '{"promotions":[]}\n' },
  { defect: 'D8', file: 'index.html',
    from: '<img src="img/photo.svg" width="240" height="160">',
    to: '<img src="img/photo.svg" width="240" height="160" alt="Verrière du loft vue de l\'intérieur">' },
  { defect: 'D8', file: 'css/style.css', from: '.legende{color:#aaa;', to: '.legende{color:#595959;' },
];

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

// Returns Map<relative path, Buffer> of what site-fixed/ must contain.
export function buildFixed(srcDir = path.join(ROOT, 'site')) {
  const files = new Map(listFiles(srcDir).map((f) => [f, fs.readFileSync(path.join(srcDir, f))]));
  for (const p of PATCHES) {
    if (p.create !== undefined) {
      if (files.has(p.file)) throw new Error(`${p.defect}: ${p.file} already exists in site/`);
      files.set(p.file, Buffer.from(p.create));
      continue;
    }
    const text = files.get(p.file)?.toString('utf8');
    if (text === undefined) throw new Error(`${p.defect}: missing ${p.file}`);
    const n = text.split(p.from).length - 1;
    if (n !== 1) throw new Error(`${p.defect}: pattern found ${n} times in ${p.file} (expected 1)`);
    files.set(p.file, Buffer.from(text.replace(p.from, () => p.to)));
  }
  return files;
}

// Differences between the expected site-fixed/ and the committed one.
export function driftFixed(fixedDir = path.join(ROOT, 'site-fixed')) {
  const want = buildFixed();
  const have = fs.existsSync(fixedDir) ? new Map(listFiles(fixedDir).map((f) => [f, fs.readFileSync(path.join(fixedDir, f))])) : new Map();
  const problems = [];
  for (const [f, buf] of want) {
    if (!have.has(f)) problems.push(`missing in site-fixed: ${f}`);
    else if (!have.get(f).equals(buf)) problems.push(`differs from patched site/: ${f}`);
  }
  for (const f of have.keys()) if (!want.has(f)) problems.push(`unexpected file in site-fixed: ${f}`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = driftFixed();
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('site-fixed/ matches site/ + patches');
  } else {
    const out = path.join(ROOT, 'site-fixed');
    fs.rmSync(out, { recursive: true, force: true });
    for (const [f, buf] of buildFixed()) {
      fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
      fs.writeFileSync(path.join(out, f), buf);
    }
    console.log(`site-fixed/ written (${PATCHES.length} patches)`);
  }
}
