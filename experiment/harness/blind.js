#!/usr/bin/env node
// blind.js: writes blind/R01..R12.md (reports without any mention of the condition or tool, shuffled order, fixed seed)
// and blind/_mapping.json (the key; never show it to the judge), under $EXP_RUN_DIR (default experiment/run).
// The cleaning is purely lexical (tool names, paths, MCP function names); the content of the findings is kept.
// Usage: node harness/blind.js
const fs = require('fs'), path = require('path');
const EXP = process.env.EXP_RUN_DIR ? path.resolve(process.env.EXP_RUN_DIR) : path.resolve(__dirname, '..', 'run');
fs.mkdirSync(path.join(EXP, 'blind'), { recursive: true });
const SEED = 777; let st = SEED; const rnd = () => (st = (st * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ids = []; for (const c of ['c0', 'c1', 'c2', 'c3']) for (const n of [1, 2, 3]) if (fs.existsSync(path.join(EXP, 'reports', `${c}-${n}.md`))) ids.push(`${c}-${n}`);
for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
const subs = [
  [/`?mcp__[\w-]+__\w+`?/g, 'the tool'], [/`?browser_\w+`?/g, 'the tool'],
  [/`?(?:take_snapshot|take_screenshot|evaluate_script|list_console_messages|list_network_requests|get_console_message|get_network_request|navigate_page|new_page|emulate|resize_page|lighthouse_audit)`?/g, 'the tool'],
  [/`?pw-run`?/g, 'the script'], [/\b(?:Playwright|Puppeteer|Chrome DevTools(?: MCP)?|DevTools MCP|Lighthouse|Chromium|MCP)\b/g, 'the browser tooling'],
  [/\/(?:home|Users|mnt)\/[^\s`)'"]*/g, '<path>'], [/\b(?:exp\/)?(?:work|mcp-out|site)\/[\w./-]*/g, '<path>'],
  [/\b(?:Read|Grep|Glob|Write|Bash)\s+tool\b/g, 'tool'],
];
const mapping = {}; const mapping_removed = {}; let i = 1;
for (const id of ids) {
  const name = 'R' + String(i++).padStart(2, '0');
  let t = fs.readFileSync(path.join(EXP, 'reports', `${id}.md`), 'utf8');
  for (const [re, r] of subs) t = t.replace(re, r);
  t = t.replace(/the the browser tooling/g, 'the browser').replace(/the browser tooling \(the browser tooling\)/g, 'the browser').replace(/the browser tooling/g, 'the browser');
  // Removes method sentences (outside the findings lists) that give the condition away: rendered or not, tool refusals, etc.
  const META = /(curl|denied|reading the source|from the source|source-only|no rendering|rendered or run|render the page|could not render|couldn.t render|screenshots?|DOM measurements|I measured|permission|tool call|did not run|without a browser|no browser)/i;
  let removed = 0;
  t = t.split('\n').map(line => {
    if (/^\s*(-|\*\*|#|\d+\.)/.test(line) || !line.trim()) return line;
    const kept = line.split(/(?<=[.!?])\s+/).filter(x => !META.test(x));
    removed += line.split(/(?<=[.!?])\s+/).length - kept.length; return kept.join(' ');
  }).join('\n');
  mapping_removed[name] = removed;
  fs.writeFileSync(path.join(EXP, 'blind', `${name}.md`), t);
  mapping[name] = id;
}
fs.writeFileSync(path.join(EXP, 'blind', '_mapping.json'), JSON.stringify({ seed: SEED, mapping }, null, 1));
console.log(Object.keys(mapping).length, 'reports; method sentences removed per report:', JSON.stringify(mapping_removed));
